import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';
import { getDatabase } from '../database/sqlite';
import { SaleTransactionPayload, SyncQueueItem } from '../types/database';

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5_000;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const SYNCABLE_ENTITIES = new Set(['clients', 'sale_transactions']);

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

let currentState: SyncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null,
};

type StateListener = (state: SyncState) => void;
const listeners = new Set<StateListener>();
let syncInterval: ReturnType<typeof setInterval> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;
let syncPromise: Promise<{ success: boolean; processed: number; pulled: number }> | null = null;

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

function getRetryDelay(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(attempts - 1, 0), 5 * 60 * 1000);
}

function getErrorDetails(error: unknown): { code?: string; status?: number; message: string } {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : String(error),
    };
  }
  return { message: String(error || 'Error de sincronización.') };
}

function isRetryable(error: unknown): boolean {
  const details = getErrorDetails(error);
  if (details.status && details.status >= 400 && details.status < 500 && details.status !== 408 && details.status !== 429) return false;
  return !['23505', '42501', '22023', 'P0001', 'P0002'].includes(details.code || '');
}

async function markProcessing(item: SyncQueueItem): Promise<boolean> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `UPDATE sync_queue SET status = 'processing', updated_at = ?
     WHERE id = ? AND status IN ('pending', 'failed')
     AND attempts < ? AND (retry_at IS NULL OR retry_at <= ?)`,
    [now, item.id, MAX_ATTEMPTS, now],
  );
  return result.changes > 0;
}

async function markSuccess(item: SyncQueueItem): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'synced', processed_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, item.id],
  );
}

async function markFailure(item: SyncQueueItem, message: string, retryable: boolean): Promise<void> {
  const db = await getDatabase();
  const attempts = item.attempts + 1;
  const now = new Date().toISOString();
  const retryAt = retryable && attempts < MAX_ATTEMPTS
    ? new Date(Date.now() + getRetryDelay(attempts)).toISOString()
    : null;
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'failed', attempts = ?, last_error = ?, retry_at = ?, updated_at = ?
     WHERE id = ?`,
    [attempts, message.slice(0, 500), retryAt, now, item.id],
  );
}

async function recoverAbandonedItems(): Promise<void> {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'failed', retry_at = ?, last_error = ?, updated_at = ?
     WHERE status = 'processing' AND updated_at < ?`,
    [now, 'Operación recuperada después de un cierre inesperado.', now, cutoff],
  );
}

async function pushSaleTransaction(payload: SaleTransactionPayload): Promise<void> {
  const { error } = await supabase.functions.invoke('process-sale', { body: payload });
  if (error) throw error;
}

async function pushQueueItem(item: SyncQueueItem): Promise<void> {
  const payload = JSON.parse(item.payload) as Record<string, unknown>;

  if (!SYNCABLE_ENTITIES.has(item.entity)) {
    throw Object.assign(new Error(`Entidad no sincronizable desde Sales App: ${item.entity}`), {
      code: '42501',
      status: 403,
    });
  }

  if (item.entity === 'sale_transactions') {
    await pushSaleTransaction(payload as unknown as SaleTransactionPayload);
    return;
  }

  if (item.entity === 'clients') {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw userError || new Error('Sesión no disponible.');
    payload.owner_id = userData.user.id;
  }

  let error: { message: string; code?: string; status?: number } | null = null;
  if (item.entity === 'clients') {
    if (item.operation === 'INSERT') {
      ({ error } = await supabase.from('clients').upsert(payload));
    } else if (item.operation === 'UPDATE') {
      ({ error } = await supabase.from('clients').update(payload).eq('id', item.entity_id));
    } else if (item.operation === 'DELETE') {
      ({ error } = await supabase.from('clients').delete().eq('id', item.entity_id));
    }
  }
  if (error) throw error;
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue
       WHERE status IN ('pending', 'failed') AND attempts < ?
       AND (retry_at IS NULL OR retry_at <= ?)`,
      [MAX_ATTEMPTS, new Date().toISOString()],
    );
    const count = result?.count ?? 0;
    updateState({ pendingCount: count });
    return count;
  } catch {
    return currentState.pendingCount;
  }
}

export async function processSyncQueue(): Promise<{ success: boolean; processed: number }> {
  await recoverAbandonedItems();
  const db = await getDatabase();
  const pendingItems = await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE status IN ('pending', 'failed') AND attempts < ?
     AND (retry_at IS NULL OR retry_at <= ?)
     ORDER BY CASE entity WHEN 'clients' THEN 0 WHEN 'sale_transactions' THEN 1 ELSE 2 END,
              created_at ASC, id ASC LIMIT 50`,
    [MAX_ATTEMPTS, new Date().toISOString()],
  );

  let processed = 0;
  for (const item of pendingItems) {
    const claimed = await markProcessing(item);
    if (!claimed) continue;
    try {
      await pushQueueItem(item);
      await markSuccess(item);
      processed++;
    } catch (error: unknown) {
      const message = getErrorDetails(error).message;
      await markFailure(item, message, isRetryable(error));
    }
  }
  await getPendingSyncCount();
  return { success: true, processed };
}

export async function pullFromSupabase(): Promise<{ success: boolean; pulled: number }> {
  const db = await getDatabase();
  let pulled = 0;
  const [categories, products, clients] = await Promise.all([
    supabase.from('categories').select('*').order('updated_at', { ascending: true }),
    supabase.from('products').select('*').eq('active', 1).is('deleted_at', null).order('updated_at', { ascending: true }),
    supabase.from('clients').select('*').order('updated_at', { ascending: true }),
  ]);

  if (categories.error || products.error || clients.error) {
    throw categories.error || products.error || clients.error;
  }

  for (const cat of categories.data || []) {
    await db.runAsync(
      `INSERT INTO categories (id, name, parent_id, owner_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, parent_id = excluded.parent_id,
       owner_id = excluded.owner_id, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [cat.id, cat.name, cat.parent_id || null, cat.owner_id || null, cat.created_at, cat.updated_at, cat.deleted_at || null],
    );
    pulled++;
  }
  for (const product of products.data || []) {
    await db.runAsync(
      `INSERT INTO products (id, name, description, category_id, type, price, cost, stock, sku, supplier, active, owner_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       category_id = excluded.category_id, type = excluded.type, price = excluded.price,
       cost = excluded.cost, stock = excluded.stock, sku = excluded.sku, supplier = excluded.supplier,
       active = excluded.active, owner_id = excluded.owner_id, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [product.id, product.name, product.description || null, product.category_id || null, product.type || null,
        product.price || 0, product.cost || 0, product.stock || 0, product.sku || null, product.supplier || null,
        product.active ?? 1, product.owner_id || null, product.created_at, product.updated_at, product.deleted_at || null],
    );
    pulled++;
  }
  for (const client of clients.data || []) {
    await db.runAsync(
      `INSERT INTO clients (id, name, phone, email, rut, notes, owner_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email,
       rut = excluded.rut, notes = excluded.notes, owner_id = excluded.owner_id,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [client.id, client.name, client.phone || null, client.email || null, client.rut || null, client.notes || null,
        client.owner_id || null, client.created_at, client.updated_at, client.deleted_at || null],
    );
    pulled++;
  }
  return { success: true, pulled };
}

async function runSync(): Promise<{ success: boolean; processed: number; pulled: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await getPendingSyncCount();
    return { success: false, processed: 0, pulled: 0 };
  }

  updateState({ isSyncing: true, lastError: null });
  try {
    const push = await processSyncQueue();
    const pull = await pullFromSupabase();
    updateState({ isSyncing: false, lastSyncTime: new Date().toISOString(), lastError: null });
    return { success: push.success && pull.success, processed: push.processed, pulled: pull.pulled };
  } catch (error: unknown) {
    const message = getErrorDetails(error).message;
    updateState({ isSyncing: false, lastError: message });
    await getPendingSyncCount();
    return { success: false, processed: 0, pulled: 0 };
  }
}

export function syncAll(): Promise<{ success: boolean; processed: number; pulled: number }> {
  if (syncPromise) return syncPromise;
  syncPromise = runSync().finally(() => { syncPromise = null; });
  return syncPromise;
}

export function initSyncEngine(): () => void {
  if (syncInterval) clearInterval(syncInterval);
  netInfoUnsubscribe?.();

  netInfoUnsubscribe = NetInfo.addEventListener(state => {
    const isOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
    updateState({ isOnline });
    if (isOnline) void syncAll();
  });

  void syncAll();
  syncInterval = setInterval(() => {
    if (currentState.isOnline) void syncAll();
  }, 2 * 60 * 1000);

  return stopSyncEngine;
}

export function stopSyncEngine(): void {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
}
