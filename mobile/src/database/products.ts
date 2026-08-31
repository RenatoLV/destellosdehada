import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Product } from '../types/database';

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
}

export async function createProductLocal(input: CreateProductInput): Promise<string> {
  const db = await getDatabase();
  const productId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. CREAR EL PRODUCTO
    await db.runAsync(
      `INSERT INTO products (id, name, description, category_id, type, price, cost, stock, sku, supplier, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        productId, input.name, input.description || null, input.categoryId || null, input.type || null,
        input.price, input.cost || 0, input.stock, input.sku || null, input.supplier || null, now, now
      ]
    );

    const productPayload = JSON.stringify({
      id: productId, name: input.name, description: input.description, category_id: input.categoryId,
      type: input.type, price: input.price, cost: input.cost || 0, stock: input.stock, sku: input.sku,
      supplier: input.supplier, active: 1, created_at: now, updated_at: now
    });
    
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'products', ?, ?, ?)`,
      [Crypto.randomUUID(), productId, productPayload, now]
    );

    // 2. CREAR MOVIMIENTO DE STOCK INICIAL (Si > 0)
    if (input.stock > 0) {
      const movementId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO inventory_movements (id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, 'INITIAL_STOCK', ?, 'Inventario inicial', 0, ?, ?)`,
        [movementId, productId, input.stock, input.stock, now]
      );

      const movPayload = JSON.stringify({
        id: movementId, product_id: productId, type: 'INITIAL_STOCK', quantity: input.stock,
        reason: 'Inventario inicial', stock_before: 0, stock_after: input.stock, created_at: now
      });

      await db.runAsync(
        `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'inventory_movements', ?, ?, ?)`,
        [Crypto.randomUUID(), movementId, movPayload, now]
      );
    }

    // 3. CREAR LA IMAGEN DEL PRODUCTO (Si existe)
    if (input.localImageUri) {
      const imageId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO product_images (id, product_id, local_uri, is_primary, sort_order, created_at)
         VALUES (?, ?, ?, 1, 0, ?)`,
        [imageId, productId, input.localImageUri, now]
      );

      const imgPayload = JSON.stringify({
        id: imageId, product_id: productId, local_uri: input.localImageUri, is_primary: 1, sort_order: 0, created_at: now
      });

      await db.runAsync(
        `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'product_images', ?, ?, ?)`,
        [Crypto.randomUUID(), imageId, imgPayload, now]
      );
    }
  });

  return productId;
}

export async function getProductsLocal(): Promise<Product[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Product>(`
    SELECT p.*,
           (SELECT local_uri FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image_uri
    FROM products p
    WHERE p.deleted_at IS NULL
    ORDER BY p.created_at DESC
  `);
}

export async function updateProductLocal(id: string, input: Partial<CreateProductInput> & { active?: number }): Promise<void> {
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
      WHERE id = ? AND deleted_at IS NULL`,
      [
        input.name || null, input.description || null, input.categoryId || null, input.type || null,
        input.price ?? null, input.cost ?? null, input.sku || null, input.supplier || null,
        input.active ?? null, now, id
      ]
    );

    if (input.localImageUri) {
      await db.runAsync(`UPDATE product_images SET is_primary = 0 WHERE product_id = ?`, [id]);
      
      const imageId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO product_images (id, product_id, local_uri, is_primary, sort_order, created_at) VALUES (?, ?, ?, 1, 0, ?)`,
        [imageId, id, input.localImageUri, now]
      );
    }

    const payload = JSON.stringify({ id, ...input, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'UPDATE', 'products', ?, ?, ?)`,
      [Crypto.randomUUID(), id, payload, now]
    );
  });
}

export async function softDeleteProductLocal(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE products SET deleted_at = ?, active = 0 WHERE id = ?`,
      [now, id]
    );

    const payload = JSON.stringify({ id, deleted_at: now, active: 0 });
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'DELETE', 'products', ?, ?, ?)`,
      [Crypto.randomUUID(), id, payload, now]
    );
  });
}

// Obtener todos los productos que están en la papelera (Soft Deleted)
export async function getDeletedProductsLocal(): Promise<Product[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Product>(`
    SELECT p.*,
           (SELECT local_uri FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image_uri
    FROM products p
    WHERE p.deleted_at IS NOT NULL
    ORDER BY p.deleted_at DESC
  `);
}

// Restaurar un producto de la papelera (Quitar el Soft Delete)
export async function restoreProductLocal(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Quitar la marca de eliminado y reactivar
    await db.runAsync(
      `UPDATE products SET deleted_at = NULL, active = 1, updated_at = ? WHERE id = ?`,
      [now, id]
    );

    // 2. Avisar a la cola de sincronización que este producto se actualizó
    const payload = JSON.stringify({ id, deleted_at: null, active: 1, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'UPDATE', 'products', ?, ?, ?)`,
      [Crypto.randomUUID(), id, payload, now]
    );
  });
}
