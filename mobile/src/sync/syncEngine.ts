import * as SQLite from 'expo-sqlite';
import { supabase } from '../services/supabase';

const DB_NAME = 'database.db';
const BUCKET_NAME = 'productos'; 

/**
 * Función auxiliar para subir una foto local a Supabase Storage.
 */
async function uploadImageToSupabase(localUri: string): Promise<string | null> {
  try {
    if (localUri.startsWith('http')) return localUri;

    const response = await fetch(localUri);
    const blob = await response.blob();
    
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if (error) {
      console.error('Error al subir imagen a Storage:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Excepción al subir imagen:', error);
    return null;
  }
}

/**
 * Crea la tabla de sincronización si no existe. 
 * La ponemos al principio para que las demás funciones puedan usarla.
 */
async function setupSyncTable() {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error("Error al crear la tabla sync_queue:", error);
  }
}

/**
 * Cuenta cuántas operaciones locales están pendientes de subir a Supabase.
 */
export async function getPendingSyncCount(): Promise<number> {
  try {
    await setupSyncTable(); // <-- ASEGURAMOS QUE LA TABLA EXISTA PRIMERO
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
    );
    return result?.count ?? 0;
  } catch (error) {
    // Si aún así falla (ej. base de datos bloqueada), devolvemos 0 silenciosamente
    return 0; 
  }
}

/**
 * Sube las operaciones pendientes locales (SQLite) hacia Supabase.
 */
export async function processSyncQueue(): Promise<{ success: boolean; processed: number }> {
  try {
    await setupSyncTable(); // <-- ASEGURAMOS QUE LA TABLA EXISTA PRIMERO
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    const pendingItems = await db.getAllAsync<any>(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`
    );

    if (!pendingItems || pendingItems.length === 0) {
      return { success: true, processed: 0 };
    }

    let processedCount = 0;

    for (const item of pendingItems) {
      let payload = JSON.parse(item.payload);
      let error = null;

      if ((item.operation === 'INSERT' || item.operation === 'UPDATE') && payload.localImageUri) {
        const publicUrl = await uploadImageToSupabase(payload.localImageUri);
        if (publicUrl) {
          payload.image_uri = publicUrl; 
        }
        delete payload.localImageUri; 
      }

      if (item.operation === 'INSERT') {
        const res = await supabase.from(item.entity).insert(payload);
        error = res.error;
      } else if (item.operation === 'UPDATE') {
        const res = await supabase.from(item.entity).update(payload).eq('id', item.entity_id);
        error = res.error;
      } else if (item.operation === 'DELETE') {
        const res = await supabase.from(item.entity).delete().eq('id', item.entity_id);
        error = res.error;
      }

      if (!error) {
        await db.runAsync(`UPDATE sync_queue SET status = 'synced' WHERE id = ?`, [item.id]);
        processedCount++;
      } else {
        await db.runAsync(
          `UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
          [error.message, item.id]
        );
      }
    }

    return { success: true, processed: processedCount };
  } catch (error) {
    console.error('Error al procesar la cola de sincronización:', error);
    return { success: false, processed: 0 };
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicializa el motor de sincronización para que se ejecute en segundo plano.
 */
export function initSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  processSyncQueue(); // Ya no necesita un .then() porque procesSyncQueue asegura la tabla internamente

  const TRES_MINUTOS = 3 * 60 * 1000;
  
  syncInterval = setInterval(async () => {
    const pendientes = await getPendingSyncCount();
    if (pendientes > 0) {
      console.log(`Sincronización automática: Subiendo ${pendientes} cambios pendientes...`);
      await processSyncQueue();
    }
  }, TRES_MINUTOS);
}