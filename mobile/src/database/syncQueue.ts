import { getDatabase } from './sqlite';
import { SyncQueueItem } from '../types/database';

const MAX_ATTEMPTS = 5;

// Obtiene todos los elementos pendientes o fallidos con menos de 5 intentos
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  return await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue 
     WHERE status IN ('pending', 'failed') AND attempts < ? 
     ORDER BY created_at ASC`,
    [MAX_ATTEMPTS]
  );
}

// Obtiene el total de elementos pendientes (útil para la tarjeta de estado en 'mas.tsx')
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM sync_queue WHERE status IN ('pending', 'failed') AND attempts < ?`,
    [MAX_ATTEMPTS]
  );
  return result?.total || 0;
}

// Marca un elemento como 'en proceso' para evitar ejecuciones duplicadas
export async function markSyncItemProcessing(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'processing' WHERE id = ?`,
    [id]
  );
}

// Marca el elemento como sincronizado con éxito en Supabase
export async function markSyncItemSuccess(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'synced', processed_at = ? WHERE id = ?`,
    [now, id]
  );
}

// Registra el error, incrementa los intentos y cambia el estado a 'failed'
export async function markSyncItemFailed(id: string, errorMessage: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue 
     SET status = 'failed', 
         attempts = attempts + 1, 
         last_error = ? 
     WHERE id = ?`,
    [errorMessage, id]
  );
}

// Elimina registros antiguos ya sincronizados para mantener la base liviana
export async function clearSyncedItems(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE status = 'synced'`);
}