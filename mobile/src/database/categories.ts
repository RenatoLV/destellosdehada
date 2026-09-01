import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Category } from '../types/database';
import { getCurrentOrganizationId, getCurrentUserId } from '../services/organizationContext';

export async function getCategoriesLocal(): Promise<Category[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE organization_id = ? ORDER BY name ASC',
    [organizationId],
  );
}

export async function addCategoryLocal(name: string, parentId: string | null = null): Promise<string> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Insertar categoría en SQLite
    await db.runAsync(
      `INSERT INTO categories (id, name, parent_id, organization_id, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, parentId, organizationId, userId, now, now]
    );

    // 2. Registrar operación en sync_queue
    const payload = JSON.stringify({
      id, name, parent_id: parentId, organization_id: organizationId,
      owner_id: userId, created_at: now, updated_at: now,
    });
    
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'INSERT', 'categories', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, id, payload, now]
    );
  });

  return id;
}
