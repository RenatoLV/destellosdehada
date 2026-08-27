import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';
import { getDatabase } from '../database/sqlite';

const BUCKET_NAME = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || 'productos';

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

// Estado global de sincronización en memoria
let currentState: SyncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null,
};

type StateListener = (state: SyncState) => void;
const listeners: Set<StateListener> = new Set();

function updateState(partial: Partial<SyncState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (e) {
      console.error('Error notifying sync listener:', e);
    }
  });
}

export function subscribeSyncState(listener: StateListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncState(): SyncState {
  return currentState;
}

/**
 * Sube una imagen local al bucket de Supabase Storage.
 */
async function uploadImageToSupabase(localUri: string): Promise<string | null> {
  try {
    if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
      return localUri;
    }

    const response = await fetch(localUri);
    const blob = await response.blob();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Storage upload warning:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return publicUrlData?.publicUrl || null;
  } catch (error: any) {
    console.warn('Excepción al subir imagen:', error?.message || error);
    return null;
  }
}

/**
 * Cuenta cuántas operaciones locales están pendientes de subir a Supabase.
 */
export async function getPendingSyncCount(): Promise<number> {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'"
    );
    const count = result?.count ?? 0;
    updateState({ pendingCount: count });
    return count;
  } catch (error) {
    return 0;
  }
}

/**
 * 1. PUSH: Sube las operaciones pendientes locales (SQLite) hacia Supabase.
 */
export async function processSyncQueue(): Promise<{ success: boolean; processed: number }> {
  try {
    const db = await getDatabase();

    const pendingItems = await db.getAllAsync<any>(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50"
    );

    if (!pendingItems || pendingItems.length === 0) {
      updateState({ pendingCount: 0 });
      return { success: true, processed: 0 };
    }

    let processedCount = 0;

    for (const item of pendingItems) {
      let payload = JSON.parse(item.payload);
      let error = null;

      if ((item.operation === 'INSERT' || item.operation === 'UPDATE') && payload.local_uri) {
        const publicUrl = await uploadImageToSupabase(payload.local_uri);
        if (publicUrl) {
          payload.storage_path = publicUrl;
        }
      }

      // SANITIZACIÓN PARA EVITAR ERROR UUID DE SUPABASE
      if (item.entity === 'products') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (payload.category_id && !uuidRegex.test(payload.category_id)) {
          // Si Supabase espera UUID y tenemos "cat_general", lo volvemos nulo para evitar error 400
          payload.category_id = null;
        }
      }
      if (item.entity === 'categories' && payload.id === 'cat_general') {
        // Ignorar subida de categoría quemada "cat_general" porque Supabase puede requerir UUID
        await db.runAsync("UPDATE sync_queue SET status = 'synced' WHERE id = ?", [item.id]);
        continue;
      }

      if (item.operation === 'INSERT') {
        const res = await supabase.from(item.entity).upsert(payload);
        error = res.error;
      } else if (item.operation === 'UPDATE') {
        const res = await supabase.from(item.entity).update(payload).eq('id', item.entity_id);
        error = res.error;
      } else if (item.operation === 'DELETE') {
        const res = await supabase.from(item.entity).delete().eq('id', item.entity_id);
        error = res.error;
      }

      if (!error) {
        await db.runAsync("UPDATE sync_queue SET status = 'synced' WHERE id = ?", [item.id]);
        processedCount++;
      } else {
        console.warn(`Sync error for ${item.entity}:`, error.message);
        await db.runAsync(
          "UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?",
          [error.message, item.id]
        );
      }
    }

    await getPendingSyncCount();
    return { success: true, processed: processedCount };
  } catch (error: any) {
    console.error('Error procesando cola de sincronización:', error);
    updateState({ lastError: error?.message || 'Error de sincronización' });
    return { success: false, processed: 0 };
  }
}

/**
 * 2. PULL: Descarga datos actualizados desde Supabase e hidrata SQLite local.
 */
export async function pullFromSupabase(): Promise<{ success: boolean; pulled: number }> {
  try {
    const db = await getDatabase();
    let totalPulled = 0;

    // A. Categorías remotas
    const { data: remoteCategories, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .order('updated_at', { ascending: true });

    if (!catErr && remoteCategories && remoteCategories.length > 0) {
      for (const cat of remoteCategories) {
        await db.runAsync(
          `INSERT INTO categories (id, name, parent_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             parent_id = excluded.parent_id,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at`,
          [cat.id, cat.name, cat.parent_id || null, cat.created_at, cat.updated_at, cat.deleted_at || null]
        );
        totalPulled++;
      }
    }

    // B. Productos remotos
    const { data: remoteProducts, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('updated_at', { ascending: true });

    if (!prodErr && remoteProducts && remoteProducts.length > 0) {
      for (const prod of remoteProducts) {
        await db.runAsync(
          `INSERT INTO products (id, name, description, category_id, type, price, cost, stock, sku, supplier, active, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             category_id = excluded.category_id,
             type = excluded.type,
             price = excluded.price,
             cost = excluded.cost,
             stock = excluded.stock,
             sku = excluded.sku,
             supplier = excluded.supplier,
             active = excluded.active,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at`,
          [
            prod.id, prod.name, prod.description || null, prod.category_id || null,
            prod.type || null, prod.price || 0, prod.cost || 0, prod.stock || 0,
            prod.sku || null, prod.supplier || null, prod.active ?? 1,
            prod.created_at, prod.updated_at, prod.deleted_at || null
          ]
        );
        totalPulled++;
      }
    }

    // 3. Traer Clientes (Clients)
    const { data: remoteClients, error: cliErr } = await supabase
      .from('clients')
      .select('*')
      .order('updated_at', { ascending: true });

    if (!cliErr && remoteClients && remoteClients.length > 0) {
      // Nos aseguramos que la tabla exista antes de insertar
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          rut TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT
        );
      `);

      for (const cli of remoteClients) {
        await db.runAsync(
          `INSERT INTO clients (id, name, phone, email, rut, notes, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             phone = excluded.phone,
             email = excluded.email,
             rut = excluded.rut,
             notes = excluded.notes,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at`,
          [
            cli.id, cli.name, cli.phone || null, cli.email || null,
            cli.rut || null, cli.notes || null,
            cli.created_at, cli.updated_at, cli.deleted_at || null
          ]
        );
        totalPulled++;
      }
    }

    return { success: true, pulled: totalPulled };
  } catch (error: any) {
    console.warn('Error en pull desde Supabase:', error?.message || error);
    return { success: false, pulled: 0 };
  }
}

/**
 * 3. SINCRONIZACIÓN COMPLETA (Push local changes + Pull remote changes)
 */
export async function syncAll(): Promise<{ success: boolean; processed: number; pulled: number }> {
  if (currentState.isSyncing) {
    return { success: false, processed: 0, pulled: 0 };
  }

  updateState({ isSyncing: true, lastError: null });

  try {
    const pushResult = await processSyncQueue();
    const pullResult = await pullFromSupabase();

    const now = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    updateState({
      isSyncing: false,
      lastSyncTime: now,
      lastError: null,
    });

    return {
      success: pushResult.success && pullResult.success,
      processed: pushResult.processed,
      pulled: pullResult.pulled,
    };
  } catch (error: any) {
    console.error('Error en syncAll:', error);
    updateState({
      isSyncing: false,
      lastError: error?.message || 'Error general de sincronización',
    });
    return { success: false, processed: 0, pulled: 0 };
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;

/**
 * Inicializa el motor de sincronización con escucha de red y temporizador en segundo plano.
 */
export function initSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
  }

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
    updateState({ isOnline });

    if (isOnline) {
      console.log('Conexión restaurada: sincronizando con Supabase...');
      syncAll();
    }
  });

  syncAll();

  const DOS_MINUTOS = 2 * 60 * 1000;
  syncInterval = setInterval(async () => {
    if (currentState.isOnline) {
      await syncAll();
    }
  }, DOS_MINUTOS);
}
