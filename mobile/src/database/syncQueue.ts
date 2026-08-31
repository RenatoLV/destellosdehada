import { getDatabase } from './sqlite';
import { SyncQueueItem } from '../types/database';

const MAX_ATTEMPTS = 5;

// Obtiene todos los elementos pendientes o fallidos con menos de 5 intentos
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  return await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE status IN ('pending', 'failed') AND attempts < ?
       AND (retry_at IS NULL OR retry_at <= ?)
     ORDER BY CASE entity WHEN 'clients' THEN 0 WHEN 'sale_transactions' THEN 1 ELSE 2 END,
              created_at ASC, id ASC`,
    [MAX_ATTEMPTS, new Date().toISOString()]
  );
}

// Obtiene el total de elementos pendientes (útil para la tarjeta de estado en 'mas.tsx')
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM sync_queue
     WHERE status IN ('pending', 'failed') AND attempts < ?
       AND (retry_at IS NULL OR retry_at <= ?)`,
    [MAX_ATTEMPTS, new Date().toISOString()]
  );
  return result?.total || 0;
}

// Marca un elemento como 'en proceso' para evitar ejecuciones duplicadas
export async function markSyncItemProcessing(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'processing', updated_at = ?
     WHERE id = ? AND status IN ('pending', 'failed') AND attempts < ?`,
    [new Date().toISOString(), id, MAX_ATTEMPTS]
  );
}

// Marca el elemento como sincronizado con éxito en Supabase
export async function markSyncItemSuccess(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'synced', processed_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}

// Registra el error, incrementa los intentos y cambia el estado a 'failed'
export async function markSyncItemFailed(id: string, errorMessage: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue 
     SET status = 'failed',
         attempts = attempts + 1,
         last_error = ?,
         retry_at = CASE WHEN attempts + 1 < ?
           THEN datetime('now', '+' || MIN(300, 5 * (2 << MAX(attempts, 0))) || ' seconds')
           ELSE NULL END,
         updated_at = ?
     WHERE id = ?`,
    [errorMessage, MAX_ATTEMPTS, new Date().toISOString(), id]
  );
}

// Elimina registros antiguos ya sincronizados para mantener la base liviana
export async function clearSyncedItems(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE status = 'synced'`);
}
