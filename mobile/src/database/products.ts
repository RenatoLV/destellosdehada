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
  images?: LocalProductImageInput[];
  primaryImageId?: string;
}

export interface LocalProductImageInput {
  uri: string;
  mimeType?: string;
  fileName?: string;
  isPrimary?: boolean;
}

function normalizeProductImages(input: Pick<CreateProductInput, 'images' | 'localImageUri' | 'localImageMimeType' | 'localImageFileName'>): LocalProductImageInput[] {
  if (input.images?.length) return input.images.slice(0, 3);
  if (!input.localImageUri) return [];
  return [{
    uri: input.localImageUri,
    mimeType: input.localImageMimeType,
    fileName: input.localImageFileName,
    isPrimary: true,
  }];
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
    
    const pendingCategoryQueue = input.categoryId
      ? await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sync_queue
         WHERE organization_id = ? AND entity = 'categories' AND entity_id = ?
           AND status IN ('pending', 'processing', 'failed')
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, input.categoryId],
      )
      : null;

    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, depends_on, created_at)
       VALUES (?, ?, ?, 'INSERT', 'products', ?, ?, NULL, ?, ?)`,
      [productQueueId, organizationId, userId, productId, productPayload,
        pendingCategoryQueue ? JSON.stringify([pendingCategoryQueue.id]) : null, now]
    );

    // 2. CREAR MOVIMIENTO DE STOCK INICIAL (Si > 0)
    if (input.stock > 0) {
      await db.runAsync(
        `INSERT INTO inventory_movements (id, organization_id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, ?, ?, 'INITIAL_STOCK', ?, 'Inventario inicial', 0, ?, ?)`,
        [initialMovementId, organizationId, userId, productId, input.stock, input.stock, now]
      );
    }

    // 3. CREAR HASTA TRES IMÁGENES. Una sola queda marcada como principal.
    const images = normalizeProductImages(input);
    const requestedPrimaryIndex = images.findIndex(image => image.isPrimary);
    const primaryIndex = requestedPrimaryIndex >= 0 ? requestedPrimaryIndex : 0;
    for (const [index, image] of images.entries()) {
      const imageId = Crypto.randomUUID();
      const isPrimary = index === primaryIndex ? 1 : 0;
      await db.runAsync(
        `INSERT INTO product_images (id, organization_id, owner_id, product_id, local_uri, is_primary, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [imageId, organizationId, userId, productId, image.uri, isPrimary, index, now]
      );

      const imgPayload = JSON.stringify({
        id: imageId, organization_id: organizationId, owner_id: userId,
        product_id: productId, local_uri: image.uri,
        mime_type: image.mimeType || 'image/jpeg',
        file_name: image.fileName || `producto-${productId}-${index + 1}.jpg`,
        is_primary: isPrimary, sort_order: index, created_at: now
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
           (SELECT CASE
              WHEN local_uri LIKE 'http%' THEN local_uri
              WHEN storage_path IS NOT NULL AND length(storage_path) > 0
                THEN 'https://lh3.googleusercontent.com/d/' || storage_path || '=w1200'
              ELSE local_uri
            END FROM product_images
            WHERE product_id = p.id AND organization_id = p.organization_id
              AND is_primary = 1 LIMIT 1) as image_uri
    FROM products p
    WHERE p.organization_id = ? AND p.deleted_at IS NULL
    ORDER BY p.created_at DESC
  `, [organizationId]);
}

export async function getProductImagesLocal(productId: string): Promise<import('../types/database').ProductImage[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  const images = await db.getAllAsync<import('../types/database').ProductImage>(
    `SELECT * FROM product_images
     WHERE product_id = ? AND organization_id = ?
     ORDER BY is_primary DESC, sort_order ASC, created_at ASC`,
    [productId, organizationId],
  );
  return images.map((image) => ({
    ...image,
    local_uri: image.local_uri?.startsWith('http')
      ? image.local_uri
      : image.storage_path
        ? `https://lh3.googleusercontent.com/d/${image.storage_path}=w1200`
        : image.local_uri,
  }));
}

export async function updateProductLocal(id: string, input: Partial<CreateProductInput> & { active?: number }): Promise<void> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const now = new Date().toISOString();
  const productQueueId = Crypto.randomUUID();

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

    const existingImages = await db.getAllAsync<import('../types/database').ProductImage>(
      `SELECT * FROM product_images WHERE product_id = ? AND organization_id = ?
       ORDER BY is_primary DESC, sort_order ASC, created_at ASC`,
      [id, organizationId],
    );
    const newImages = input.images?.slice(0, Math.max(0, 3 - existingImages.length))
      ?? normalizeProductImages(input);
    const newPrimaryIndex = newImages.findIndex(image => image.isPrimary);
    const wantsNewPrimary = newPrimaryIndex >= 0;
    const wantsExistingPrimary = Boolean(input.primaryImageId);

    if (wantsNewPrimary || wantsExistingPrimary) {
      for (const existingImage of existingImages) {
        const nextPrimary = wantsExistingPrimary && existingImage.id === input.primaryImageId ? 1 : 0;
        if (existingImage.is_primary === nextPrimary) continue;
        await db.runAsync(
          `UPDATE product_images SET is_primary = ? WHERE id = ? AND organization_id = ?`,
          [nextPrimary, existingImage.id, organizationId],
        );
        if (nextPrimary !== 1) continue;
        const primaryPayload = JSON.stringify({
          id: existingImage.id,
          organization_id: organizationId,
          product_id: id,
          is_primary: nextPrimary,
          sort_order: existingImage.sort_order,
          updated_at: now,
        });
        await db.runAsync(
          `INSERT INTO sync_queue
           (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, depends_on, created_at)
           VALUES (?, ?, ?, 'UPDATE', 'product_images', ?, ?, NULL, ?, ?)`,
          [Crypto.randomUUID(), organizationId, userId, existingImage.id, primaryPayload,
            JSON.stringify([productQueueId]), now],
        );
      }
    }

    for (const [index, image] of newImages.entries()) {
      const imageId = Crypto.randomUUID();
      const isPrimary = wantsNewPrimary && index === newPrimaryIndex ? 1 : 0;
      const sortOrder = existingImages.length + index;
      await db.runAsync(
        `INSERT INTO product_images (id, organization_id, owner_id, product_id, local_uri, is_primary, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [imageId, organizationId, userId, id, image.uri, isPrimary, sortOrder, now],
      );
      const imagePayload = JSON.stringify({
        id: imageId,
        organization_id: organizationId,
        owner_id: userId,
        product_id: id,
        local_uri: image.uri,
        mime_type: image.mimeType || 'image/jpeg',
        file_name: image.fileName || `producto-${id}-${sortOrder + 1}.jpg`,
        is_primary: isPrimary,
        sort_order: sortOrder,
        created_at: now,
      });
      await db.runAsync(
        `INSERT INTO sync_queue
         (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, depends_on, created_at)
         VALUES (?, ?, ?, 'INSERT', 'product_images', ?, ?, NULL, ?, ?)`,
        [Crypto.randomUUID(), organizationId, userId, imageId, imagePayload,
          JSON.stringify([productQueueId]), now],
      );
    }

    const payload = JSON.stringify({ id, organization_id: organizationId, ...input, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'UPDATE', 'products', ?, ?, NULL, ?)`,
      [productQueueId, organizationId, userId, id, payload, now]
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
           (SELECT CASE
              WHEN local_uri LIKE 'http%' THEN local_uri
              WHEN storage_path IS NOT NULL AND length(storage_path) > 0
                THEN 'https://lh3.googleusercontent.com/d/' || storage_path || '=w1200'
              ELSE local_uri
            END FROM product_images
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
