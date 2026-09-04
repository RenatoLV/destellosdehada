import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { getDatabase } from '../database/sqlite';
import { getActiveOrganizationContext } from '../services/organizationContext';
import {
  AttachReceiptResult,
  ProcessSaleResult,
  RecoverySaleResult,
  Receipt,
  ReserveReceiptResult,
  SaleTransactionPayload,
  SyncQueueItem,
  SyncStatus,
} from '../types/database';
import {
  inspectLocalReceiptFile,
  isReceiptMimeType,
  uploadReceiptToStorage,
} from '../services/receiptStorage';
import { setReceiptUploading } from '../database/receipts';
import { uploadProductImageToDrive } from '../services/productImageStorage';
import {
  classifySyncFailure,
  getSyncErrorDetails as getErrorDetails,
  isStockConflict,
  type SyncErrorDetails,
} from './syncPolicy';

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const SYNC_LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const SYNCABLE_ENTITIES = new Set([
  'categories',
  'products',
  'product_images',
  'clients',
  'sale_transactions',
  'receipt_upload',
  'receipt_attach',
]);
const PULL_ENTITIES = ['categories', 'products', 'product_images', 'clients', 'receipts'] as const;
const SYNC_OWNER = `sync-${Crypto.randomUUID()}`;

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  blockedCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

export interface SyncDiagnostics {
  organizationId: string | null;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  blockedCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

let currentState: SyncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  processingCount: 0,
  failedCount: 0,
  blockedCount: 0,
  lastSyncTime: null,
  lastError: null,
};

type StateListener = (state: SyncState) => void;
const listeners = new Set<StateListener>();
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;
let webConnectivityUnsubscribe: (() => void) | null = null;
let syncPromise: Promise<{ success: boolean; processed: number; pulled: number }> | null = null;

class SyncError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly conflict: boolean;

  constructor(message: string, details: Omit<SyncErrorDetails, 'message'> = {}) {
    super(message);
    this.name = 'SyncError';
    this.code = details.code;
    this.status = details.status;
    this.retryable = details.retryable ?? false;
    this.conflict = details.conflict ?? false;
  }
}

function updateState(partial: Partial<SyncState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach(listener => listener(currentState));
}

export function subscribeSyncState(listener: StateListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
  return currentState;
}

function logSyncEvent(event: string, metadata: Record<string, string | number | undefined> = {}) {
  console.info(`[SYNC] ${event} ${JSON.stringify(metadata)}`);
}

function getRetryDelay(attempts: number): number {
  const exponential = Math.min(RETRY_BASE_MS * 2 ** Math.max(attempts - 1, 0), RETRY_MAX_MS);
  const jitter = Math.floor(Math.random() * Math.max(1_000, exponential * 0.2));
  return Math.min(exponential + jitter, RETRY_MAX_MS);
}

function asPayload(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new SyncError('Payload de sincronización inválido.', { code: 'INVALID_PAYLOAD', status: 422 });
  }
}

async function acquireSyncLock(): Promise<boolean> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const expiredAt = new Date(Date.now() - SYNC_LOCK_TIMEOUT_MS).toISOString();
  const result = await db.runAsync(
    `INSERT INTO sync_lock (id, owner, acquired_at, heartbeat_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET owner = excluded.owner,
       acquired_at = excluded.acquired_at, heartbeat_at = excluded.heartbeat_at
     WHERE sync_lock.owner = ? OR sync_lock.heartbeat_at < ?`,
    [SYNC_OWNER, now, now, SYNC_OWNER, expiredAt],
  );
  if (result.changes > 0) logSyncEvent('SYNC_LOCK_ACQUIRED');
  return result.changes > 0;
}

async function heartbeatSyncLock(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sync_lock SET heartbeat_at = ? WHERE id = 1 AND owner = ?', [new Date().toISOString(), SYNC_OWNER]);
}

async function releaseSyncLock(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM sync_lock WHERE id = 1 AND owner = ?', [SYNC_OWNER]);
    logSyncEvent('SYNC_LOCK_RELEASED');
  } catch {
    // The timeout permits recovery on the next run.
  }
}

async function recoverAbandonedItems(organizationId: string): Promise<void> {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'failed', retry_at = ?, next_attempt_at = ?, processing_started_at = NULL,
         last_error = ?, updated_at = ?
     WHERE organization_id = ? AND status = 'processing'
       AND processing_started_at IS NOT NULL AND processing_started_at < ?`,
    [now, now, 'Operación recuperada después de un cierre inesperado.', now, organizationId, cutoff],
  );
  await db.runAsync(
    `UPDATE sales SET sync_error = ?, recovery_state = 'recovering'
     WHERE organization_id = ? AND status = 'pending'
       AND id IN (SELECT entity_id FROM sync_queue
                  WHERE organization_id = ? AND entity = 'sale_transactions' AND status = 'failed')`,
    ['Operación recuperada después de un cierre inesperado.', organizationId, organizationId],
  );
  await db.runAsync(
    `UPDATE receipts SET upload_status = 'failed', last_error = ?, updated_at = ?
     WHERE organization_id = ? AND upload_status = 'uploading'
       AND id IN (
         SELECT entity_id FROM sync_queue
         WHERE organization_id = ? AND entity = 'receipt_upload' AND status = 'failed'
       )`,
    ['Upload recuperado después de un cierre inesperado.', now, organizationId, organizationId],
  );
}

/**
 * A manual sync is an explicit operator decision to retry non-transactional
 * catalog work. Automatic retries still stop at MAX_ATTEMPTS, but a product
 * or category that failed while the server was being repaired must not remain
 * stranded forever in the local queue.
 */
async function resetManualCatalogRetries(organizationId: string, userId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending', attempts = 0, retry_at = NULL, next_attempt_at = NULL,
         processing_started_at = NULL, last_error = NULL, updated_at = ?
     WHERE organization_id = ? AND user_id = ? AND status IN ('failed', 'processing', 'blocked')
       AND entity IN ('categories', 'products', 'product_images', 'clients')`,
    [now, organizationId, userId],
  );
}

async function markProcessing(item: SyncQueueItem, organizationId: string, userId: string): Promise<boolean> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `UPDATE sync_queue SET status = 'processing', processing_started_at = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND user_id = ?
       AND status IN ('pending', 'failed') AND attempts < ?
       AND (retry_at IS NULL OR retry_at <= ?)`,
    [now, now, item.id, organizationId, userId, MAX_ATTEMPTS, now],
  );
  if (result.changes > 0 && item.entity === 'sale_transactions') {
    await db.runAsync(`UPDATE sales SET sync_error = NULL
                       WHERE id = ? AND organization_id = ? AND status = 'pending'`, [item.entity_id, organizationId]);
  }
  return result.changes > 0;
}

async function markSuccess(
  item: SyncQueueItem,
  organizationId: string,
  result?: ProcessSaleResult,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE sync_queue SET status = 'synced', processed_at = ?, processing_started_at = NULL,
         retry_at = NULL, next_attempt_at = NULL, last_error = NULL, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [now, now, item.id, organizationId],
    );
    if (item.entity === 'sale_transactions') {
      const sale = await db.getFirstAsync<{ status: string }>(
        `SELECT status FROM sales WHERE id = ? AND organization_id = ?`, [item.entity_id, organizationId]);
      if (sale?.status === 'pending') {
        const items = await db.getAllAsync<{ product_id: string; quantity: number }>(
          `SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND organization_id = ?`,
          [item.entity_id, organizationId]);
        for (const saleItem of items) {
          await db.runAsync(
            `UPDATE products SET pending_stock_delta = COALESCE(pending_stock_delta, 0) + ?
             WHERE id = ? AND organization_id = ?`,
            [saleItem.quantity, saleItem.product_id, organizationId]);
        }
        await db.runAsync(
          `UPDATE sales SET status = 'confirmed', payment_id = ?, server_payload_hash = ?,
             recovery_state = 'none', confirmed_at = ?, sync_error = NULL,
             conflict_code = NULL, conflict_message = NULL
           WHERE id = ? AND organization_id = ?`,
          [result?.payment_id ?? null, result?.server_payload_hash ?? null, now, item.entity_id, organizationId],
        );
      } else if (result?.payment_id) {
        await db.runAsync(
          `UPDATE sales SET payment_id = ?, server_payload_hash = ?, recovery_state = 'none'
           WHERE id = ? AND organization_id = ?`,
          [result.payment_id, result.server_payload_hash ?? null, item.entity_id, organizationId],
        );
      }
      if (result?.payment_id) {
        await db.runAsync(
          `UPDATE payments SET remote_id = ?, status = 'confirmed', confirmed_at = ?
           WHERE sale_id = ? AND organization_id = ?`,
          [result.payment_id, now, item.entity_id, organizationId],
        );
        await db.runAsync(
          `UPDATE receipts SET payment_id = ?, updated_at = ?
           WHERE sale_id = ? AND organization_id = ? AND payment_id IS NULL`,
          [result.payment_id, now, item.entity_id, organizationId],
        );
      }
    } else if (item.entity === 'receipt_upload') {
      const receipt = await db.getFirstAsync<Receipt>(
        `SELECT * FROM receipts WHERE id = ? AND organization_id = ?`, [item.entity_id, organizationId],
      );
      if (!receipt?.storage_path || !receipt.payment_id) {
        throw new Error('El comprobante no tiene ruta o pago remoto para asociarse.');
      }
      await db.runAsync(
        `UPDATE receipts SET upload_status = 'uploaded', last_error = NULL, updated_at = ?
         WHERE id = ? AND organization_id = ?`, [now, item.entity_id, organizationId],
      );
      const attachPayload = JSON.stringify({
        receipt_id: receipt.id,
        sale_id: receipt.sale_id,
        payment_id: receipt.payment_id,
        organization_id: organizationId,
        user_id: item.user_id,
        storage_path: receipt.storage_path,
        mime_type: receipt.mime_type,
        file_size: receipt.file_size,
        checksum: receipt.checksum,
      });
      await db.runAsync(
        `INSERT INTO sync_queue
         (id, organization_id, user_id, operation, entity, entity_id, payload, depends_on, created_at)
         SELECT ?, ?, ?, 'INSERT', 'receipt_attach', ?, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM sync_queue WHERE organization_id = ?
             AND entity = 'receipt_attach' AND entity_id = ?
             AND status IN ('pending', 'processing', 'failed', 'synced')
         )`,
        [Crypto.randomUUID(), organizationId, item.user_id, receipt.id, attachPayload,
          JSON.stringify([item.id]), now, organizationId, receipt.id],
      );
    } else if (item.entity === 'receipt_attach') {
      await db.runAsync(
        `UPDATE receipts SET upload_status = 'uploaded', last_error = NULL,
           uploaded_at = COALESCE(uploaded_at, ?), updated_at = ?
         WHERE id = ? AND organization_id = ?`, [now, now, item.entity_id, organizationId],
      );
    }
  });
  logSyncEvent('SYNC_ITEM_SUCCESS', { entity: item.entity, entityId: item.entity_id });
}

async function releaseSaleReservation(item: SyncQueueItem, error: SyncErrorDetails, organizationId: string, userId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const conflict = isStockConflict(error);
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<{ status: string }>(
      `SELECT status FROM sales WHERE id = ? AND organization_id = ?`, [item.entity_id, organizationId]);
    if (!sale || sale.status !== 'pending') return;
    const items = await db.getAllAsync<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND organization_id = ?`,
      [item.entity_id, organizationId]);
    for (const saleItem of items) {
      const product = await db.getFirstAsync<{ stock: number }>(
        `SELECT stock FROM products WHERE id = ? AND organization_id = ?`, [saleItem.product_id, organizationId]);
      if (!product) continue;
      const stockAfter = product.stock + saleItem.quantity;
      await db.runAsync(
        `UPDATE products SET stock = ?, pending_stock_delta = COALESCE(pending_stock_delta, 0) + ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [stockAfter, saleItem.quantity, now, saleItem.product_id, organizationId]);
      await db.runAsync(
        `INSERT INTO inventory_movements
         (id, organization_id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, ?, ?, 'RETURN', ?, ?, ?, ?, ?)`,
        [Crypto.randomUUID(), organizationId, userId, saleItem.product_id, saleItem.quantity,
          `Liberación de reserva por ${conflict ? 'conflicto de stock' : 'rechazo de venta'}`,
          product.stock, stockAfter, now]);
    }
    await db.runAsync(
      `UPDATE sales SET status = ?, recovery_state = 'none', sync_error = ?, conflict_code = ?, conflict_message = ?, rejected_at = ?
       WHERE id = ? AND organization_id = ?`,
      [conflict ? 'conflict' : 'rejected', error.message.slice(0, 500),
        conflict ? (error.code || 'STOCK_CONFLICT') : (error.code || 'SALE_REJECTED'),
        conflict ? error.message.slice(0, 500) : null, now, item.entity_id, organizationId]);
    await db.runAsync(
      `UPDATE payments SET status = 'rejected', confirmed_at = NULL
       WHERE sale_id = ? AND organization_id = ? AND status = 'pending'`,
      [item.entity_id, organizationId],
    );
  });
  logSyncEvent(conflict ? 'SYNC_CONFLICT' : 'SYNC_ITEM_BLOCKED', { entity: item.entity, entityId: item.entity_id, code: error.code });
}

async function markFailure(item: SyncQueueItem, error: unknown, organizationId: string, userId: string): Promise<void> {
  const details = getErrorDetails(error);
  const attempts = item.attempts + 1;
  const policy = classifySyncFailure(error, attempts, MAX_ATTEMPTS);
  const blocked = policy.queueStatus === 'blocked';
  const now = new Date().toISOString();
  const retryAt = !blocked ? new Date(Date.now() + getRetryDelay(attempts)).toISOString() : null;
  const db = await getDatabase();
  updateState({ lastError: details.message });
  await db.runAsync(
    `UPDATE sync_queue SET status = ?, attempts = ?, last_error = ?, retry_at = ?, next_attempt_at = ?,
       processing_started_at = NULL, updated_at = ?
     WHERE id = ? AND organization_id = ? AND user_id = ?`,
    [blocked ? 'blocked' : 'failed', attempts, details.message.slice(0, 500), retryAt, retryAt,
      now, item.id, organizationId, userId]);

  const uncertainSale = item.entity === 'sale_transactions' && policy.saleDisposition === 'recover';
  if (uncertainSale) {
    await db.runAsync(
      `UPDATE sales SET recovery_state = 'recovering', recovery_attempts = recovery_attempts + 1,
         last_recovery_at = ?, sync_error = ?
       WHERE id = ? AND organization_id = ? AND status = 'pending'`,
      [now, details.message.slice(0, 500), item.entity_id, organizationId],
    );
  } else if (item.entity === 'sale_transactions' && policy.saleDisposition === 'release') {
    await releaseSaleReservation(item, details, organizationId, userId);
  } else if (item.entity === 'sale_transactions') {
    await db.runAsync(`UPDATE sales SET sync_error = ?
                       WHERE id = ? AND organization_id = ? AND status = 'pending'`,
      [details.message.slice(0, 500), item.entity_id, organizationId]);
  } else if (item.entity === 'receipt_upload') {
    await db.runAsync(
      `UPDATE receipts SET upload_status = 'failed', last_error = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [details.message.slice(0, 500), now, item.entity_id, organizationId],
    );
  } else if (item.entity === 'receipt_attach') {
    await db.runAsync(
      `UPDATE receipts SET last_error = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [details.message.slice(0, 500), now, item.entity_id, organizationId],
    );
  }
  logSyncEvent(blocked ? 'SYNC_ITEM_BLOCKED' : 'SYNC_ITEM_RETRY', { entity: item.entity, entityId: item.entity_id, attempts, code: details.code });
}

async function pushSaleTransaction(payload: SaleTransactionPayload, organizationId: string): Promise<ProcessSaleResult> {
  if (payload.organization_id !== organizationId || !payload.idempotency_key) {
    throw new SyncError('La venta no tiene un contexto o idempotencia válidos.', { code: 'INVALID_SALE_CONTEXT', status: 422 });
  }
  const payloadHash = payload.payload_hash || await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(payload),
  );
  if (!payload.payload_hash) {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sales SET payload_hash = ?
       WHERE id = ? AND organization_id = ? AND payload_hash IS NULL`,
      [payloadHash, payload.id, organizationId],
    );
  }
  const body = { ...payload, payload_hash: payloadHash };
  const { data, error } = await supabase.functions.invoke('process-sale', { body });
  if (error) throw error;
  if (data === null || data === undefined) {
    throw new SyncError('process-sale no devolvió un resultado semántico.', { code: 'INVALID_REMOTE_RESULT', status: 502, retryable: true });
  }
  if (typeof data === 'object' && data !== null) {
    const result = data as ProcessSaleResult;
    if (result.success === false || result.status === 'rejected' || result.status === 'conflict') {
      const code = typeof result.code === 'string' ? result.code : 'SALE_REJECTED';
      const message = typeof result.message === 'string' ? result.message : 'La venta fue rechazada por Supabase.';
      throw new SyncError(message, {
        code,
        status: 409,
        conflict: result.status === 'conflict' || ['STOCK_CONFLICT', 'STOCK_INSUFFICIENT', 'PRICE_CHANGED'].includes(code),
      });
    }
    if (result.success !== true || typeof result.sale_id !== 'string' || result.sale_id !== payload.id) {
      throw new SyncError('process-sale devolvió un resultado incompleto.', {
        code: 'INVALID_REMOTE_RESULT',
        status: 502,
        retryable: true,
      });
    }
    return result;
  }
  throw new SyncError('process-sale devolvió un resultado inválido.', {
    code: 'INVALID_REMOTE_RESULT',
    status: 502,
    retryable: true,
  });
}

async function getLocalReceiptForSync(receiptId: string, organizationId: string): Promise<Receipt> {
  const db = await getDatabase();
  const receipt = await db.getFirstAsync<Receipt>(
    `SELECT * FROM receipts WHERE id = ? AND organization_id = ?`, [receiptId, organizationId],
  );
  if (!receipt) throw new SyncError('El comprobante local no existe.', { code: 'RECEIPT_NOT_FOUND', status: 422 });
  return receipt;
}

async function pushReceiptUpload(item: SyncQueueItem, organizationId: string): Promise<void> {
  const receipt = await getLocalReceiptForSync(item.entity_id, organizationId);
  if (!isReceiptMimeType(receipt.mime_type)) {
    throw new SyncError('El tipo de comprobante no está permitido.', { code: 'INVALID_RECEIPT', status: 422 });
  }
  const db = await getDatabase();
  const sale = await db.getFirstAsync<{ status: string; payment_id: string | null }>(
    `SELECT status, payment_id FROM sales WHERE id = ? AND organization_id = ?`,
    [receipt.sale_id, organizationId],
  );
  if (!sale) throw new SyncError('La venta del comprobante no existe.', { code: 'SALE_NOT_FOUND', status: 422 });
  if (sale.status !== 'confirmed') {
    throw new SyncError('El comprobante espera la confirmación de su venta.', { code: 'SALE_NOT_CONFIRMED', status: 409, retryable: true });
  }
  const paymentId = receipt.payment_id ?? sale.payment_id;
  if (!paymentId) {
    throw new SyncError('El pago remoto aún no está disponible.', { code: 'PAYMENT_NOT_AVAILABLE', status: 409, retryable: true });
  }
  let fileInfo: Awaited<ReturnType<typeof inspectLocalReceiptFile>>;
  try {
    fileInfo = await inspectLocalReceiptFile(receipt.local_uri);
  } catch (error) {
    throw new SyncError(error instanceof Error ? error.message : 'El archivo del comprobante no está disponible.', {
      code: 'RECEIPT_FILE_UNAVAILABLE',
      status: 422,
    });
  }
  if (receipt.file_size !== null && receipt.file_size !== fileInfo.size) {
    throw new SyncError('El archivo del comprobante cambió después de ser encolado.', {
      code: 'RECEIPT_PAYLOAD_MISMATCH',
      status: 409,
      conflict: true,
    });
  }
  if (receipt.checksum && receipt.checksum !== fileInfo.checksum) {
    throw new SyncError('El archivo del comprobante cambió después de ser encolado.', {
      code: 'RECEIPT_PAYLOAD_MISMATCH',
      status: 409,
      conflict: true,
    });
  }
  const { data: reservationData, error: reservationError } = await supabase.rpc('reserve_receipt', {
    p_organization_id: organizationId,
    p_sale_id: receipt.sale_id,
    p_payment_id: paymentId,
    p_receipt_id: receipt.id,
    p_mime_type: receipt.mime_type,
    p_file_size: fileInfo.size,
    p_checksum: fileInfo.checksum,
  });
  if (reservationError) throw reservationError;
  const reservation = reservationData as ReserveReceiptResult | null;
  if (!reservation || reservation.success !== true || reservation.receipt_id !== receipt.id
    || !reservation.storage_path) {
    throw new SyncError(reservation?.message ?? 'No fue posible reservar el comprobante.', {
      code: reservation?.code ?? 'INVALID_RECEIPT_RESERVATION',
      status: reservation?.code === 'INTERNAL_ERROR' ? 500 : 409,
      retryable: reservation?.code === 'INTERNAL_ERROR',
    });
  }
  const storagePath = reservation.storage_path;
  await db.runAsync(
    `UPDATE receipts SET payment_id = ?, storage_path = ?, file_size = ?,
       checksum = COALESCE(?, checksum), updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [paymentId, storagePath, fileInfo.size, fileInfo.checksum, new Date().toISOString(), receipt.id, organizationId],
  );
  await setReceiptUploading(receipt.id, organizationId);
  await uploadReceiptToStorage(receipt.local_uri, storagePath, receipt.mime_type);
}

async function pushReceiptAttach(item: SyncQueueItem, organizationId: string): Promise<void> {
  const receipt = await getLocalReceiptForSync(item.entity_id, organizationId);
  const db = await getDatabase();
  const sale = await db.getFirstAsync<{ status: string; payment_id: string | null }>(
    `SELECT status, payment_id FROM sales WHERE id = ? AND organization_id = ?`,
    [receipt.sale_id, organizationId],
  );
  if (!sale || sale.status !== 'confirmed') {
    throw new SyncError('La venta aún no está confirmada.', { code: 'SALE_NOT_CONFIRMED', status: 409, retryable: true });
  }
  const paymentId = receipt.payment_id ?? sale.payment_id;
  if (!paymentId || !receipt.storage_path || !isReceiptMimeType(receipt.mime_type) || !receipt.file_size) {
    throw new SyncError('El comprobante no tiene metadata remota completa.', { code: 'INVALID_RECEIPT', status: 422 });
  }
  const { data, error } = await supabase.rpc('attach_receipt', {
    p_organization_id: organizationId,
    p_sale_id: receipt.sale_id,
    p_payment_id: paymentId,
    p_receipt_id: receipt.id,
    p_storage_path: receipt.storage_path,
    p_mime_type: receipt.mime_type,
    p_file_size: receipt.file_size,
    p_checksum: receipt.checksum,
  });
  if (error) throw error;
  const result = data as AttachReceiptResult | null;
  if (!result || result.success !== true || result.receipt_id !== receipt.id) {
    const code = result?.code ?? 'INVALID_RECEIPT_RESULT';
    throw new SyncError(result?.message ?? 'No fue posible asociar el comprobante.', {
      code,
      status: code === 'INTERNAL_ERROR' ? 500 : 409,
      retryable: code === 'INTERNAL_ERROR' || code === 'RECEIPT_NOT_UPLOADED',
    });
  }
}

async function recordRecoveryFailure(
  saleId: string,
  organizationId: string,
  message: string,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sales SET recovery_state = 'recovering', recovery_attempts = recovery_attempts + 1,
       last_recovery_at = ?, sync_error = ?
     WHERE id = ? AND organization_id = ? AND status = 'pending'`,
    [now, message.slice(0, 500), saleId, organizationId],
  );
}

async function reconcileRecoveredSale(
  item: SyncQueueItem,
  organizationId: string,
  result: RecoverySaleResult,
): Promise<void> {
  if (result.organization_id !== organizationId || result.sale_id !== item.entity_id
    || result.status !== 'confirmed' || !result.payment_id) {
    throw new SyncError('La respuesta de recovery no coincide con la operación local.', {
      code: 'INVALID_RECOVERY_RESULT',
      status: 502,
      retryable: true,
    });
  }
  const paymentId = result.payment_id;
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<{ status: string }>(
      `SELECT status FROM sales WHERE id = ? AND organization_id = ?`, [item.entity_id, organizationId]);
    if (!sale) throw new SyncError('La venta local no existe durante recovery.', { code: 'SALE_NOT_FOUND', status: 422 });
    if (sale.status === 'pending') {
      const items = await db.getAllAsync<{ product_id: string; quantity: number }>(
        `SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND organization_id = ?`,
        [item.entity_id, organizationId]);
      for (const saleItem of items) {
        await db.runAsync(
          `UPDATE products SET pending_stock_delta = COALESCE(pending_stock_delta, 0) + ?
           WHERE id = ? AND organization_id = ?`,
          [saleItem.quantity, saleItem.product_id, organizationId]);
      }
    }
    await db.runAsync(
      `UPDATE sales SET status = 'confirmed', payment_id = ?, server_payload_hash = ?,
         recovery_state = 'none', confirmed_at = COALESCE(?, ?), sync_error = NULL,
         conflict_code = NULL, conflict_message = NULL
       WHERE id = ? AND organization_id = ?`,
      [paymentId, result.server_payload_hash ?? null, result.confirmed_at ?? now,
        now, item.entity_id, organizationId],
    );
    await db.runAsync(
      `UPDATE payments SET remote_id = ?, status = 'confirmed', confirmed_at = COALESCE(?, ?)
       WHERE sale_id = ? AND organization_id = ?`,
      [paymentId, result.confirmed_at ?? now, now, item.entity_id, organizationId],
    );
    await db.runAsync(
      `UPDATE receipts SET payment_id = ?, updated_at = ?
       WHERE sale_id = ? AND organization_id = ? AND payment_id IS NULL`,
      [paymentId, now, item.entity_id, organizationId],
    );
    await db.runAsync(
      `UPDATE sync_queue SET status = 'synced', processed_at = ?, processing_started_at = NULL,
         retry_at = NULL, next_attempt_at = NULL, last_error = NULL, updated_at = ?
       WHERE organization_id = ? AND user_id = ? AND entity = 'sale_transactions'
         AND entity_id = ? AND status <> 'synced'`,
      [now, now, organizationId, item.user_id, item.entity_id],
    );
  });
}

async function recoverPendingSales(organizationId: string, userId: string): Promise<void> {
  const db = await getDatabase();
  const candidates = await db.getAllAsync<SyncQueueItem>(
    `SELECT q.* FROM sync_queue q
     JOIN sales s ON s.id = q.entity_id AND s.organization_id = q.organization_id
     WHERE q.organization_id = ? AND q.user_id = ? AND q.entity = 'sale_transactions'
       AND q.idempotency_key IS NOT NULL AND s.status = 'pending'
       AND s.recovery_state = 'recovering'
     GROUP BY q.entity_id ORDER BY q.created_at ASC, q.id ASC LIMIT 50`,
    [organizationId, userId],
  );
  for (const item of candidates) {
    try {
      const { data, error } = await supabase.rpc('get_sale_by_idempotency_key', {
        p_organization_id: organizationId,
        p_idempotency_key: item.idempotency_key,
      });
      if (error) throw error;
      const result = data as RecoverySaleResult | null;
      if (!result) throw new SyncError('Recovery no devolvió resultado.', { code: 'INVALID_RECOVERY_RESULT', status: 502, retryable: true });
      if (!result.found) {
        if (result.code !== 'NOT_FOUND') {
          throw new SyncError('No fue posible verificar el estado remoto de la venta.', {
            code: result.code ?? 'RECOVERY_FAILED', status: 409, retryable: false,
          });
        }
        const now = new Date().toISOString();
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `UPDATE sales SET recovery_state = 'none', recovery_attempts = 0,
               last_recovery_at = ?, sync_error = NULL
             WHERE id = ? AND organization_id = ? AND status = 'pending'`,
            [now, item.entity_id, organizationId],
          );
          await db.runAsync(
            `UPDATE sync_queue SET status = 'pending', attempts = 0, retry_at = ?,
               next_attempt_at = ?, processing_started_at = NULL, last_error = NULL, updated_at = ?
             WHERE organization_id = ? AND user_id = ? AND entity = 'sale_transactions'
               AND entity_id = ? AND status <> 'synced'`,
            [now, now, now, organizationId, userId, item.entity_id],
          );
        });
      } else if (result.status === 'confirmed') {
        await reconcileRecoveredSale(item, organizationId, result);
      } else if (result.status === 'rejected' || result.status === 'conflict') {
        await releaseSaleReservation(item, {
          code: result.conflict_code ?? 'SALE_REJECTED',
          message: result.conflict_message ?? 'La venta fue rechazada remotamente.',
          conflict: result.status === 'conflict',
          retryable: false,
        }, organizationId, userId);
        await db.runAsync(
          `UPDATE sync_queue SET status = 'synced', processed_at = ?, processing_started_at = NULL,
             retry_at = NULL, next_attempt_at = NULL, updated_at = ?
           WHERE id = ? AND organization_id = ?`,
          [new Date().toISOString(), new Date().toISOString(), item.id, organizationId],
        );
      } else {
        throw new SyncError('Recovery devolvió un estado remoto desconocido.', {
          code: 'INVALID_RECOVERY_RESULT', status: 502, retryable: true,
        });
      }
    } catch (error) {
      await recordRecoveryFailure(item.entity_id, organizationId,
        getErrorDetails(error).message || 'No fue posible recuperar la venta.');
      logSyncEvent('SALE_RECOVERY_RETRY', { entity: item.entity, entityId: item.entity_id });
    }
  }
}

async function validateQueueItem(item: SyncQueueItem, organizationId: string, userId: string): Promise<Record<string, unknown>> {
  if (!item.organization_id || item.organization_id !== organizationId || item.user_id !== userId) {
    throw new SyncError('La operación no pertenece al contexto activo.', { code: 'ORGANIZATION_CONTEXT_MISMATCH', status: 403 });
  }
  if (!item.entity || !item.entity_id || !item.operation || !item.payload) {
    throw new SyncError('La operación de sincronización está incompleta.', { code: 'INVALID_QUEUE_ITEM', status: 422 });
  }
  if (item.entity === 'sale_transactions' && !item.idempotency_key) {
    throw new SyncError('La venta no tiene idempotency_key.', { code: 'MISSING_IDEMPOTENCY_KEY', status: 422 });
  }
  const payload = asPayload(item.payload);
  if (payload.organization_id !== undefined && payload.organization_id !== organizationId) {
    throw new SyncError('El payload pertenece a otra organización.', { code: 'ORGANIZATION_CONTEXT_MISMATCH', status: 403 });
  }
  payload.organization_id = organizationId;
  return payload;
}

async function dependenciesAreSynced(item: SyncQueueItem, organizationId: string): Promise<boolean> {
  if (!item.depends_on) return true;
  let parsed: unknown;
  try { parsed = JSON.parse(item.depends_on); } catch {
    throw new SyncError('Dependencias de cola inválidas.', { code: 'INVALID_DEPENDENCIES', status: 422 });
  }
  if (!Array.isArray(parsed)) throw new SyncError('Dependencias de cola inválidas.', { code: 'INVALID_DEPENDENCIES', status: 422 });
  const db = await getDatabase();
  for (const dependency of parsed) {
    if (typeof dependency !== 'string') throw new SyncError('Dependencia de cola inválida.', { code: 'INVALID_DEPENDENCY', status: 422 });
    const row = await db.getFirstAsync<{ status: SyncStatus }>(
      `SELECT status FROM sync_queue WHERE id = ? AND organization_id = ?`, [dependency, organizationId]);
    if (!row || row.status !== 'synced') return false;
  }
  return true;
}

async function hasBlockedDependency(item: SyncQueueItem, organizationId: string): Promise<boolean> {
  if (!item.depends_on) return false;
  const parsed: unknown = JSON.parse(item.depends_on);
  if (!Array.isArray(parsed)) return false;
  const db = await getDatabase();
  for (const dependency of parsed) {
    if (typeof dependency !== 'string') continue;
    const row = await db.getFirstAsync<{ status: SyncStatus }>(
      `SELECT status FROM sync_queue WHERE id = ? AND organization_id = ?`, [dependency, organizationId],
    );
    if (row?.status === 'blocked') return true;
  }
  return false;
}

async function blockOrphanedReceipt(item: SyncQueueItem, organizationId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE sync_queue SET status = 'blocked', last_error = ?, processing_started_at = NULL, updated_at = ?
       WHERE id = ? AND organization_id = ? AND status IN ('pending', 'failed')`,
      ['La venta dependiente fue rechazada; el comprobante quedó local y no se subirá.', now, item.id, organizationId],
    );
    await db.runAsync(
      `UPDATE receipts SET upload_status = 'failed', last_error = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      ['La venta no fue confirmada; el comprobante permanece local.', now, item.entity_id, organizationId],
    );
  });
}

async function pushQueueItem(
  item: SyncQueueItem,
  organizationId: string,
  userId: string,
): Promise<ProcessSaleResult | undefined> {
  if (!SYNCABLE_ENTITIES.has(item.entity)) {
    throw new SyncError(`Entidad no sincronizable desde Sales App: ${item.entity}`, { code: 'UNSUPPORTED_ENTITY', status: 403 });
  }
  const payload = await validateQueueItem(item, organizationId, userId);
  if (item.entity === 'sale_transactions') {
    return pushSaleTransaction(payload as unknown as SaleTransactionPayload, organizationId);
  }
  if (item.entity === 'receipt_upload') {
    await pushReceiptUpload(item, organizationId);
    return undefined;
  }
  if (item.entity === 'receipt_attach') {
    await pushReceiptAttach(item, organizationId);
    return undefined;
  }

  if (item.entity === 'products' && item.operation === 'INSERT') {
    const { data, error } = await supabase.rpc('create_product_admin', {
      p_organization_id: organizationId,
      p_product: payload,
    });
    if (error) throw error;
    const result = data as { success?: boolean; product_id?: string; code?: string } | null;
    if (!result?.success || result.product_id !== item.entity_id) {
      throw new SyncError(result?.code || 'No fue posible registrar el producto.', {
        code: result?.code || 'PRODUCT_CREATE_FAILED',
        status: 409,
      });
    }
    return undefined;
  }

  if (item.entity === 'product_images') {
    const localUri = typeof payload.local_uri === 'string' ? payload.local_uri : '';
    const productId = typeof payload.product_id === 'string' ? payload.product_id : '';
    const mimeType = typeof payload.mime_type === 'string' ? payload.mime_type : 'image/jpeg';
    const fileName = typeof payload.file_name === 'string' ? payload.file_name : `producto-${productId}.jpg`;
    if (!localUri || !productId) {
      throw new SyncError('La imagen local no contiene producto o archivo.', {
        code: 'INVALID_IMAGE_PAYLOAD',
        status: 422,
      });
    }
    const result = await uploadProductImageToDrive({
      imageId: item.entity_id,
      organizationId,
      productId,
      localUri,
      mimeType,
      fileName,
      createdAt: typeof payload.created_at === 'string' ? payload.created_at : undefined,
    });
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE product_images SET storage_path = ?
       WHERE id = ? AND organization_id = ?`,
      [result.file_id ?? null, item.entity_id, organizationId],
    );
    return undefined;
  }

  const tableName = item.entity === 'categories' ? 'categories'
    : item.entity === 'products' ? 'products'
      : 'clients';
  const remotePayload = { ...payload };
  delete remotePayload.initial_movement_id;
  delete remotePayload.localImageUri;
  delete remotePayload.localImageMimeType;
  delete remotePayload.localImageFileName;
  if ('categoryId' in remotePayload) {
    remotePayload.category_id = remotePayload.categoryId;
    delete remotePayload.categoryId;
  }
  const table = supabase.from(tableName);
  let response: { error: { message: string; code?: string; status?: number } | null };
  if (item.operation === 'INSERT') response = await table.upsert(remotePayload);
  else if (item.operation === 'UPDATE' || item.operation === 'DELETE') {
    response = await table.update(remotePayload).eq('id', item.entity_id).eq('organization_id', organizationId);
  }
  else throw new SyncError(`Operación no soportada: ${item.operation}`, { code: 'UNSUPPORTED_OPERATION', status: 422 });
  if (response.error) throw response.error;
}

async function getQueueCounts(organizationId: string): Promise<Pick<SyncState, 'pendingCount' | 'processingCount' | 'failedCount' | 'blockedCount'>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: SyncStatus; count: number }>(
    `SELECT status, COUNT(*) AS count FROM sync_queue WHERE organization_id = ? GROUP BY status`, [organizationId]);
  const counts = { pendingCount: 0, processingCount: 0, failedCount: 0, blockedCount: 0 };
  rows.forEach(row => {
    if (row.status === 'pending') counts.pendingCount = row.count;
    if (row.status === 'processing') counts.processingCount = row.count;
    if (row.status === 'failed') counts.failedCount = row.count;
    if (row.status === 'blocked') counts.blockedCount = row.count;
  });
  return counts;
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const context = await getActiveOrganizationContext();
    const counts = await getQueueCounts(context.organizationId);
    updateState({ ...counts, pendingCount: counts.pendingCount + counts.failedCount });
    return counts.pendingCount + counts.failedCount;
  } catch {
    updateState({ pendingCount: 0, processingCount: 0, failedCount: 0, blockedCount: 0 });
    return 0;
  }
}

export async function getSyncDiagnostics(): Promise<SyncDiagnostics> {
  try {
    const context = await getActiveOrganizationContext();
    const db = await getDatabase();
    const counts = await getQueueCounts(context.organizationId);
    const cursor = await db.getFirstAsync<{ last_sync_at: string | null }>(
      `SELECT MAX(updated_at) AS last_sync_at FROM sync_cursors WHERE organization_id = ?`,
      [context.organizationId],
    );
    return {
      organizationId: context.organizationId,
      ...counts,
      lastSyncAt: cursor?.last_sync_at ?? currentState.lastSyncTime,
      lastSyncError: currentState.lastError,
    };
  } catch {
    return {
      organizationId: null,
      pendingCount: 0,
      processingCount: 0,
      failedCount: 0,
      blockedCount: 0,
      lastSyncAt: currentState.lastSyncTime,
      lastSyncError: currentState.lastError,
    };
  }
}

async function processQueueWithLock(organizationId: string, userId: string): Promise<{ success: boolean; processed: number }> {
  await recoverAbandonedItems(organizationId);
  await recoverPendingSales(organizationId, userId);
  const db = await getDatabase();
  const pendingItems = await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE organization_id = ? AND user_id = ? AND status IN ('pending', 'failed')
       AND attempts < ? AND (retry_at IS NULL OR retry_at <= ?)
     ORDER BY CASE entity
       WHEN 'categories' THEN 0
       WHEN 'products' THEN 1
       WHEN 'product_images' THEN 2
       WHEN 'clients' THEN 3
       WHEN 'sale_transactions' THEN 4
       ELSE 5 END,
       created_at ASC, id ASC LIMIT 50`,
    [organizationId, userId, MAX_ATTEMPTS, new Date().toISOString()]);
  let processed = 0;
  let hadFailure = false;
  for (const item of pendingItems) {
    await heartbeatSyncLock();
    if (!(await dependenciesAreSynced(item, organizationId))) {
      if ((item.entity === 'receipt_upload' || item.entity === 'receipt_attach')
        && await hasBlockedDependency(item, organizationId)) {
        await blockOrphanedReceipt(item, organizationId);
      }
      continue;
    }
    if (!(await markProcessing(item, organizationId, userId))) continue;
    logSyncEvent('SYNC_ITEM_PROCESSING', { entity: item.entity, entityId: item.entity_id });
    try {
      const result = await pushQueueItem(item, organizationId, userId);
      await markSuccess(item, organizationId, result);
      processed++;
    } catch (error: unknown) {
      hadFailure = true;
      await markFailure(item, error, organizationId, userId);
    }
  }
  const counts = await getQueueCounts(organizationId);
  updateState({ ...counts, pendingCount: counts.pendingCount + counts.failedCount });
  return { success: !hadFailure, processed };
}

export async function processSyncQueue(): Promise<{ success: boolean; processed: number }> {
  let context;
  try { context = await getActiveOrganizationContext(); } catch { return { success: false, processed: 0 }; }
  if (!(await acquireSyncLock())) return { success: false, processed: 0 };
  try { return await processQueueWithLock(context.organizationId, context.userId); }
  finally { await releaseSyncLock(); }
}

type RemoteRow = Record<string, unknown> & { id: string; updated_at: string };

async function hasPendingLocalChange(organizationId: string, entity: string, entityId: string): Promise<boolean> {
  const db = await getDatabase();
  const queueEntities = entity === 'receipts'
    ? ['receipts', 'receipt_upload', 'receipt_attach']
    : [entity];
  const placeholders = queueEntities.map(() => '?').join(', ');
  const row = await db.getFirstAsync<{ row_exists: number }>(
    `SELECT 1 AS row_exists FROM sync_queue WHERE organization_id = ? AND entity IN (${placeholders}) AND entity_id = ?
       AND status IN ('pending', 'processing', 'failed', 'blocked') LIMIT 1`,
    [organizationId, ...queueEntities, entityId]);
  return Boolean(row);
}

async function hasCrossOrganizationCollision(table: string, id: string, organizationId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ organization_id: string | null }>(`SELECT organization_id FROM ${table} WHERE id = ?`, [id]);
  return Boolean(row?.organization_id && row.organization_id !== organizationId);
}

async function recordPullConflict(organizationId: string, entity: string, entityId: string, remotePayload: RemoteRow): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_conflicts
      (id, organization_id, entity, entity_id, remote_payload, conflict_code, message, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, 'LOCAL_PENDING', ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM sync_conflicts
       WHERE organization_id = ? AND entity = ? AND entity_id = ? AND status = 'open')`,
    [Crypto.randomUUID(), organizationId, entity, entityId, JSON.stringify(remotePayload),
      'El cambio remoto se conservó porque existe una operación local pendiente.', now, now,
      organizationId, entity, entityId]);
  logSyncEvent('SYNC_CONFLICT', { entity, entityId, code: 'LOCAL_PENDING' });
}

async function upsertRemoteRow(organizationId: string, entity: typeof PULL_ENTITIES[number], row: RemoteRow): Promise<void> {
  const db = await getDatabase();
  if (await hasCrossOrganizationCollision(entity, row.id, organizationId)) {
    throw new SyncError(`Colisión de identificador en ${entity}.`, { code: 'CROSS_ORGANIZATION_ID_COLLISION', status: 409, conflict: true });
  }
  if (await hasPendingLocalChange(organizationId, entity, row.id)) {
    await recordPullConflict(organizationId, entity, row.id, row);
    return;
  }
  const value = (key: string): string | number | null => {
    const candidate = row[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') return candidate;
    if (typeof candidate === 'boolean') return candidate ? 1 : 0;
    return null;
  };
  if (entity === 'categories') {
    await db.runAsync(
      `INSERT INTO categories (id, organization_id, name, parent_id, owner_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id, name = excluded.name,
         parent_id = excluded.parent_id, owner_id = excluded.owner_id, updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at`,
      [row.id, organizationId, value('name'), value('parent_id'), value('owner_id'), value('created_at'), row.updated_at, value('deleted_at')]);
  } else if (entity === 'products') {
    await db.runAsync(
      `INSERT INTO products
       (id, organization_id, name, description, category_id, type, price, cost, stock, remote_stock,
        pending_stock_delta, stock_version, sku, supplier, active, owner_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id, name = excluded.name,
         description = excluded.description, category_id = excluded.category_id, type = excluded.type,
         price = excluded.price, cost = excluded.cost,
         stock = MAX(0, excluded.stock + COALESCE(products.pending_stock_delta, 0)),
         remote_stock = excluded.remote_stock,
         sku = excluded.sku, supplier = excluded.supplier, active = excluded.active, owner_id = excluded.owner_id,
         updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [row.id, organizationId, value('name'), value('description'), value('category_id'), value('type'),
        value('price') ?? 0, value('cost') ?? 0, value('stock') ?? 0, value('stock') ?? 0, value('sku'),
        value('supplier'), value('active') ?? 1, value('owner_id'), value('created_at'), row.updated_at, value('deleted_at')]);
  } else if (entity === 'product_images') {
    await db.runAsync(
      `INSERT INTO product_images
       (id, organization_id, owner_id, product_id, local_uri, storage_path, is_primary, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id,
         owner_id = excluded.owner_id, product_id = excluded.product_id,
         local_uri = excluded.local_uri, storage_path = excluded.storage_path,
         is_primary = excluded.is_primary, sort_order = excluded.sort_order`,
      [row.id, organizationId, value('owner_id'), value('product_id'), value('local_uri'),
        value('storage_path'), value('is_primary') ?? 0, value('sort_order') ?? 0, value('created_at')],
    );
  } else if (entity === 'receipts') {
    await db.runAsync(
      `INSERT INTO receipts
       (id, organization_id, sale_id, payment_id, local_uri, storage_path, mime_type,
        file_size, checksum, upload_status, last_error, uploaded_at, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id,
         sale_id = excluded.sale_id, payment_id = excluded.payment_id,
         storage_path = excluded.storage_path, mime_type = excluded.mime_type,
         file_size = excluded.file_size, checksum = excluded.checksum,
         upload_status = excluded.upload_status, last_error = NULL,
         uploaded_at = excluded.uploaded_at, updated_at = excluded.updated_at,
         created_by = excluded.created_by`,
      [row.id, organizationId, value('sale_id'), value('payment_id'), value('storage_path'),
        value('mime_type'), value('file_size'), value('checksum'), value('status'),
        value('uploaded_at'), value('created_at'), row.updated_at, value('created_by')]);
  } else {
    await db.runAsync(
      `INSERT INTO clients
       (id, organization_id, name, phone, email, rut, notes, owner_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id, name = excluded.name,
         phone = excluded.phone, email = excluded.email, rut = excluded.rut, notes = excluded.notes,
         owner_id = excluded.owner_id, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [row.id, organizationId, value('name'), value('phone'), value('email'), value('rut'), value('notes'),
        value('owner_id'), value('created_at'), row.updated_at, value('deleted_at')]);
  }
}

async function pullEntity(organizationId: string, entity: typeof PULL_ENTITIES[number]): Promise<number> {
  const db = await getDatabase();
  const cursorRow = await db.getFirstAsync<{ cursor: string | null }>(
    `SELECT cursor FROM sync_cursors WHERE organization_id = ? AND entity = ?`, [organizationId, entity]);
  const cursor = cursorRow?.cursor;
  let query = supabase.from(entity).select('*').eq('organization_id', organizationId).order('updated_at', { ascending: true });
  if (cursor) query = query.gt('updated_at', cursor);
  const response = await query;
  if (response.error) throw response.error;
  const rows = (response.data || []) as unknown as RemoteRow[];
  let latest = cursor;
  for (const row of rows) {
    if (!row.id || !row.updated_at) continue;
    await upsertRemoteRow(organizationId, entity, row);
    if (!latest || row.updated_at > latest) latest = row.updated_at;
  }
  if (latest && latest !== cursor) {
    await db.runAsync(
      `INSERT INTO sync_cursors (organization_id, entity, cursor, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(organization_id, entity) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
      [organizationId, entity, latest, new Date().toISOString()]);
  }
  return rows.length;
}

async function pullWithLock(organizationId: string): Promise<{ success: boolean; pulled: number }> {
  let pulled = 0;
  for (const entity of PULL_ENTITIES) {
    await heartbeatSyncLock();
    pulled += await pullEntity(organizationId, entity);
  }
  return { success: true, pulled };
}

export async function pullFromSupabase(): Promise<{ success: boolean; pulled: number }> {
  let context;
  try { context = await getActiveOrganizationContext(); } catch { return { success: false, pulled: 0 }; }
  if (!(await acquireSyncLock())) return { success: false, pulled: 0 };
  try { return await pullWithLock(context.organizationId); }
  finally { await releaseSyncLock(); }
}

async function runSync(forceCatalogRetry = false): Promise<{ success: boolean; processed: number; pulled: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await getPendingSyncCount();
    return { success: false, processed: 0, pulled: 0 };
  }
  let context;
  try { context = await getActiveOrganizationContext(); }
  catch (error) {
    updateState({ lastError: error instanceof Error ? error.message : 'Organización activa no disponible.' });
    return { success: false, processed: 0, pulled: 0 };
  }
  if (!(await acquireSyncLock())) return { success: false, processed: 0, pulled: 0 };
  logSyncEvent('SYNC_START', { organizationId: context.organizationId });
  updateState({ isSyncing: true, lastError: null });
  try {
    if (forceCatalogRetry) {
      await resetManualCatalogRetries(context.organizationId, context.userId);
    }
    const push = await processQueueWithLock(context.organizationId, context.userId);
    const pull = await pullWithLock(context.organizationId);
    updateState({
      isSyncing: false,
      lastSyncTime: new Date().toISOString(),
      lastError: push.success && pull.success ? null : currentState.lastError,
    });
    return { success: push.success && pull.success, processed: push.processed, pulled: pull.pulled };
  } catch (error: unknown) {
    const message = getErrorDetails(error).message;
    updateState({ isSyncing: false, lastError: message });
    await getPendingSyncCount();
    return { success: false, processed: 0, pulled: 0 };
  } finally {
    await releaseSyncLock();
  }
}

export function syncAll(forceCatalogRetry = false): Promise<{ success: boolean; processed: number; pulled: number }> {
  if (syncPromise) return syncPromise;
  syncPromise = runSync(forceCatalogRetry).finally(() => { syncPromise = null; });
  return syncPromise;
}

export function initSyncEngine(): () => void {
  if (syncTimeout) clearTimeout(syncTimeout);
  netInfoUnsubscribe?.();
  webConnectivityUnsubscribe?.();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // NetInfo can report an unavailable reachability probe in Expo Web even
    // when the browser can reach Supabase. The browser online/offline events
    // are the reliable signal for the web client.
    const updateWebConnectivity = () => {
      const isOnline = typeof navigator === 'undefined' || navigator.onLine;
      updateState({ isOnline });
      if (isOnline) void syncAll();
    };
    window.addEventListener('online', updateWebConnectivity);
    window.addEventListener('offline', updateWebConnectivity);
    webConnectivityUnsubscribe = () => {
      window.removeEventListener('online', updateWebConnectivity);
      window.removeEventListener('offline', updateWebConnectivity);
    };
    updateWebConnectivity();
  } else {
    netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const isOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      updateState({ isOnline });
      if (isOnline) void syncAll();
    });
  }
  void syncAll();
  const scheduleNextSync = () => {
    syncTimeout = setTimeout(() => {
      if (currentState.isOnline) void syncAll();
      scheduleNextSync();
    }, SYNC_INTERVAL_MS);
  };
  scheduleNextSync();
  return stopSyncEngine;
}

export function stopSyncEngine(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = null;
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  webConnectivityUnsubscribe?.();
  webConnectivityUnsubscribe = null;
}
