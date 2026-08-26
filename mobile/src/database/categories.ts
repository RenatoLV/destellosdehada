import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Category } from '../types/database';

export async function getCategoriesLocal(): Promise<Category[]> {
  const db = await getDatabase();
  return await db.getAllAsync('SELECT * FROM categories ORDER BY name ASC');
}

export async function addCategoryLocal(name: string, parentId: string | null = null): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Insertar categoría en SQLite
    await db.runAsync(
      `INSERT INTO categories (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, name, parentId, now, now]
    );

    // 2. Registrar operación en sync_queue
    const payload = JSON.stringify({ id, name, parent_id: parentId, created_at: now, updated_at: now });
    
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'categories', ?, ?, ?)`,
      [Crypto.randomUUID(), id, payload, now]
    );
  });

  return id;
}