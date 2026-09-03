import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Product } from '../types/database';
import { getCurrentOrganizationId, getCurrentUserId } from '../services/organizationContext';

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId?: string;
  type?: string;
  price: number;
  cost?: number;
  stock: number;
  sku?: string;
  supplier?: string;
  localImageUri?: string;
  localImageMimeType?: string;
  localImageFileName?: string;
}

export async function createProductLocal(input: CreateProductInput): Promise<string> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const productId = Crypto.randomUUID();
  const productQueueId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const initialMovementId = input.stock > 0 ? Crypto.randomUUID() : null;

  await db.withTransactionAsync(async () => {
    // 1. CREAR EL PRODUCTO
    await db.runAsync(
      `INSERT INTO products
       (id, organization_id, owner_id, name, description, category_id, type, price, cost, stock,
        remote_stock, pending_stock_delta, stock_version, sku, supplier, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
      [
        productId, organizationId, userId, input.name, input.description || null, input.categoryId || null,
        input.type || null, input.price, input.cost || 0, input.stock, input.stock, input.sku || null,
        input.supplier || null, 1, now, now
      ]
    );

    const productPayload = JSON.stringify({
      id: productId, organization_id: organizationId, owner_id: userId, name: input.name,
      description: input.description, category_id: input.categoryId,
      type: input.type, price: input.price, cost: input.cost || 0, stock: input.stock, sku: input.sku,
      supplier: input.supplier, active: 1, initial_movement_id: initialMovementId,
      created_at: now, updated_at: now
    });
    
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'INSERT', 'products', ?, ?, NULL, ?)`,
      [productQueueId, organizationId, userId, productId, productPayload, now]
    );

    // 2. CREAR MOVIMIENTO DE STOCK INICIAL (Si > 0)
    if (input.stock > 0) {
      await db.runAsync(
        `INSERT INTO inventory_movements (id, organization_id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, ?, ?, 'INITIAL_STOCK', ?, 'Inventario inicial', 0, ?, ?)`,
        [initialMovementId, organizationId, userId, productId, input.stock, input.stock, now]
      );
    }

    // 3. CREAR LA IMAGEN DEL PRODUCTO (Si existe)
    if (input.localImageUri) {
      const imageId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO product_images (id, organization_id, owner_id, product_id, local_uri, is_primary, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 0, ?)`,
        [imageId, organizationId, userId, productId, input.localImageUri, now]
      );

      const imgPayload = JSON.stringify({
        id: imageId, organization_id: organizationId, owner_id: userId,
        product_id: productId, local_uri: input.localImageUri,
        mime_type: input.localImageMimeType || 'image/jpeg',
        file_name: input.localImageFileName || `producto-${productId}.jpg`,
        is_primary: 1, sort_order: 0, created_at: now
      });

      await db.runAsync(
        `INSERT INTO sync_queue
         (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, depends_on, created_at)
         VALUES (?, ?, ?, 'INSERT', 'product_images', ?, ?, NULL, ?, ?)`,
        [Crypto.randomUUID(), organizationId, userId, imageId, imgPayload,
          JSON.stringify([productQueueId]), now]
      );
    }
  });

  return productId;
}

export async function getProductsLocal(): Promise<Product[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<Product>(`
    SELECT p.*,
           (SELECT local_uri FROM product_images
            WHERE product_id = p.id AND organization_id = p.organization_id
              AND is_primary = 1 LIMIT 1) as image_uri
    FROM products p
    WHERE p.organization_id = ? AND p.deleted_at IS NULL
    ORDER BY p.created_at DESC
  `, [organizationId]);
}

export async function updateProductLocal(id: string, input: Partial<CreateProductInput> & { active?: number }): Promise<void> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE products SET 
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category_id = COALESCE(?, category_id),
        type = COALESCE(?, type),
        price = COALESCE(?, price),
        cost = COALESCE(?, cost),
        sku = COALESCE(?, sku),
        supplier = COALESCE(?, supplier),
        active = COALESCE(?, active),
        updated_at = ?
       WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`,
      [
        input.name || null, input.description || null, input.categoryId || null, input.type || null,
        input.price ?? null, input.cost ?? null, input.sku || null, input.supplier || null,
        input.active ?? null, now, id, organizationId
      ]
    );

    if (input.localImageUri) {
      await db.runAsync(
        `UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND organization_id = ?`,
        [id, organizationId],
      );
      
      const imageId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO product_images (id, organization_id, product_id, local_uri, is_primary, sort_order, created_at)
         VALUES (?, ?, ?, ?, 1, 0, ?)`,
        [imageId, organizationId, id, input.localImageUri, now]
      );
    }

    const payload = JSON.stringify({ id, organization_id: organizationId, ...input, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'UPDATE', 'products', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, id, payload, now]
    );
  });
}

export async function softDeleteProductLocal(id: string): Promise<void> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE products SET deleted_at = ?, active = 0 WHERE id = ? AND organization_id = ?`,
      [now, id, organizationId]
    );

    const payload = JSON.stringify({ id, organization_id: organizationId, deleted_at: now, active: 0 });
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'DELETE', 'products', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, id, payload, now]
    );
  });
}

// Obtener todos los productos que están en la papelera (Soft Deleted)
export async function getDeletedProductsLocal(): Promise<Product[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<Product>(`
    SELECT p.*,
           (SELECT local_uri FROM product_images
            WHERE product_id = p.id AND organization_id = p.organization_id
              AND is_primary = 1 LIMIT 1) as image_uri
    FROM products p
    WHERE p.organization_id = ? AND p.deleted_at IS NOT NULL
    ORDER BY p.deleted_at DESC
  `, [organizationId]);
}

// Restaurar un producto de la papelera (Quitar el Soft Delete)
export async function restoreProductLocal(id: string): Promise<void> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Quitar la marca de eliminado y reactivar
    await db.runAsync(
      `UPDATE products SET deleted_at = NULL, active = 1, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [now, id, organizationId]
    );

    // 2. Avisar a la cola de sincronización que este producto se actualizó
    const payload = JSON.stringify({ id, organization_id: organizationId, deleted_at: null, active: 1, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'UPDATE', 'products', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, id, payload, now]
    );
  });
}
