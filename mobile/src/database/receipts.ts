import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { getCurrentOrganizationId, getCurrentUserId } from '../services/organizationContext';
import { buildReceiptStoragePath, createReceiptSignedUrl, inspectLocalReceiptFile, isReceiptMimeType } from '../services/receiptStorage';
import { Receipt, ReceiptMimeType, SyncQueueItem } from '../types/database';

export type CheckoutReceiptStatus = 'pending' | 'uploading' | 'uploaded' | 'attached' | 'failed';

export interface CreateReceiptLocalInput {
  saleId: string;
  localUri: string;
  mimeType: ReceiptMimeType;
  fileSize?: number;
  checksum?: string | null;
}

function receiptRow(row: Receipt): Receipt {
  return row;
}

export async function createReceiptLocal(input: CreateReceiptLocalInput): Promise<string> {
  if (!isReceiptMimeType(input.mimeType)) throw new Error('Tipo de comprobante no permitido.');
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const sale = await db.getFirstAsync<{ id: string; organization_id: string; status: string; payment_id: string | null; local_payment_id: string | null }>(
    `SELECT id, organization_id, status, payment_id, local_payment_id FROM sales
     WHERE id = ? AND organization_id = ?`, [input.saleId, organizationId],
  );
  if (!sale) throw new Error('La venta no existe en la organización activa.');

  const inspected = await inspectLocalReceiptFile(input.localUri);
  if (input.fileSize !== undefined && input.fileSize !== inspected.size) {
    throw new Error('El tamaño declarado no coincide con el archivo del comprobante.');
  }
  if (input.checksum && input.checksum !== inspected.checksum) {
    throw new Error('El checksum declarado no coincide con el archivo del comprobante.');
  }
  if (!Number.isInteger(inspected.size) || inspected.size <= 0 || inspected.size > 10 * 1024 * 1024) {
    throw new Error('El comprobante debe pesar entre 1 byte y 10 MB.');
  }

  const receiptId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const storagePath = organizationId.startsWith('local:')
    ? null
    : buildReceiptStoragePath(organizationId, input.saleId, receiptId, input.mimeType);
  const shouldQueue = sale.status !== 'rejected' && sale.status !== 'conflict';

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO receipts
       (id, organization_id, sale_id, payment_id, local_payment_id, local_uri, storage_path, mime_type,
        file_size, checksum, upload_status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [receiptId, organizationId, input.saleId, sale.payment_id, sale.local_payment_id, input.localUri, storagePath,
        input.mimeType, inspected.size, inspected.checksum, now, now, userId],
    );

    if (shouldQueue) {
      const saleQueue = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sync_queue WHERE organization_id = ? AND entity = 'sale_transactions'
         AND entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`, [organizationId, input.saleId],
      );
      const payload = JSON.stringify({
        receipt_id: receiptId,
        sale_id: input.saleId,
        organization_id: organizationId,
        user_id: userId,
        local_uri: input.localUri,
        storage_path: storagePath,
        mime_type: input.mimeType,
        file_size: inspected.size,
        checksum: inspected.checksum,
      });
      await db.runAsync(
        `INSERT INTO sync_queue
         (id, organization_id, user_id, operation, entity, entity_id, payload, depends_on, created_at)
         VALUES (?, ?, ?, 'INSERT', 'receipt_upload', ?, ?, ?, ?)`,
        [Crypto.randomUUID(), organizationId, userId, receiptId, payload,
          saleQueue ? JSON.stringify([saleQueue.id]) : null, now],
      );
    }
  });
  return receiptId;
}

export async function getReceiptLocal(receiptId: string): Promise<Receipt | null> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  const row = await db.getFirstAsync<Receipt>(
    `SELECT * FROM receipts WHERE id = ? AND organization_id = ?`, [receiptId, organizationId],
  );
  return row ? receiptRow(row) : null;
}

export async function getCheckoutReceiptStatus(receiptId: string): Promise<CheckoutReceiptStatus> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  const receipt = await db.getFirstAsync<Pick<Receipt, 'upload_status'>>(
    `SELECT upload_status FROM receipts WHERE id = ? AND organization_id = ?`,
    [receiptId, organizationId],
  );
  if (!receipt) return 'pending';
  const attach = await db.getFirstAsync<Pick<SyncQueueItem, 'status'>>(
    `SELECT status FROM sync_queue
     WHERE organization_id = ? AND entity = 'receipt_attach' AND entity_id = ?
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [organizationId, receiptId],
  );
  if (attach?.status === 'synced') return 'attached';
  if (receipt.upload_status === 'failed' || attach?.status === 'blocked') return 'failed';
  return receipt.upload_status;
}

export async function getReceiptsLocal(saleId?: string): Promise<Receipt[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  if (saleId) {
    return db.getAllAsync<Receipt>(
      `SELECT * FROM receipts WHERE organization_id = ? AND sale_id = ? ORDER BY created_at DESC`,
      [organizationId, saleId],
    );
  }
  return db.getAllAsync<Receipt>(
    `SELECT * FROM receipts WHERE organization_id = ? ORDER BY created_at DESC`, [organizationId],
  );
}

export async function getReceiptSignedUrl(receiptId: string, expiresInSeconds = 300): Promise<string> {
  const receipt = await getReceiptLocal(receiptId);
  if (!receipt?.storage_path || receipt.upload_status !== 'uploaded') {
    throw new Error('El comprobante aún no está disponible remotamente.');
  }
  return createReceiptSignedUrl(receipt.storage_path, expiresInSeconds);
}

export async function setReceiptUploading(receiptId: string, organizationId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE receipts SET upload_status = 'uploading', last_error = NULL, updated_at = ?
     WHERE id = ? AND organization_id = ?`, [new Date().toISOString(), receiptId, organizationId],
  );
}

export async function setReceiptUploadFailed(receiptId: string, organizationId: string, message: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE receipts SET upload_status = 'failed', last_error = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`, [message.slice(0, 500), new Date().toISOString(), receiptId, organizationId],
  );
}

export async function setReceiptUploaded(
  receiptId: string,
  organizationId: string,
  storagePath: string,
  paymentId: string,
  uploadedAt?: string,
): Promise<void> {
  const db = await getDatabase();
  const now = uploadedAt ?? new Date().toISOString();
  await db.runAsync(
    `UPDATE receipts SET payment_id = ?, storage_path = ?, upload_status = 'uploaded',
       last_error = NULL, uploaded_at = COALESCE(uploaded_at, ?), updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [paymentId, storagePath, now, now, receiptId, organizationId],
  );
}

export async function enqueueReceiptAttach(
  receipt: Receipt,
  organizationId: string,
  userId: string,
  dependencyId: string,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const payload = JSON.stringify({
    receipt_id: receipt.id,
    sale_id: receipt.sale_id,
    payment_id: receipt.payment_id,
    organization_id: organizationId,
    user_id: userId,
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
       SELECT 1 FROM sync_queue WHERE organization_id = ? AND entity = 'receipt_attach'
       AND entity_id = ? AND status IN ('pending', 'processing', 'failed', 'synced')
     )`,
    [Crypto.randomUUID(), organizationId, userId, receipt.id, payload, JSON.stringify([dependencyId]), now,
      organizationId, receipt.id],
  );
}

export async function updateReceiptRemoteMetadata(
  receipt: Pick<Receipt, 'id'> & Partial<Receipt>,
  organizationId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE receipts SET payment_id = COALESCE(?, payment_id), storage_path = COALESCE(?, storage_path),
       upload_status = ?, uploaded_at = ?, updated_at = ?, last_error = NULL
     WHERE id = ? AND organization_id = ?`,
    [receipt.payment_id ?? null, receipt.storage_path ?? null, receipt.upload_status ?? 'uploaded',
      receipt.uploaded_at ?? null, receipt.updated_at ?? new Date().toISOString(), receipt.id, organizationId],
  );
}

export function isReceiptQueueItem(item: SyncQueueItem): boolean {
  return item.entity === 'receipt_upload' || item.entity === 'receipt_attach';
}
