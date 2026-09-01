import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { InventoryMovement } from '../types/database';
import { getCurrentOrganizationId, getCurrentUserId } from '../services/organizationContext';

interface ProductStock {
  stock: number;
}

export type MovementWithProduct = InventoryMovement & { product_name: string };

export interface StockAdjustmentInput {
  productId: string;
  type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number; // Positivo para ingresos, negativo para correcciones hacia abajo
  reason: string;
}

export async function adjustStockLocal(input: StockAdjustmentInput): Promise<string> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const movementId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Validar existencia del producto y leer el stock actual
    const product = await db.getFirstAsync<ProductStock>(
      `SELECT stock FROM products
       WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`,
      [input.productId, organizationId]
    );

    if (!product) {
      throw new Error('El producto no existe o fue eliminado.');
    }

    const stockBefore = product.stock;
    const stockAfter = stockBefore + input.quantity;

    if (stockAfter < 0) {
      throw new Error('El ajuste no puede dejar el stock en un valor menor a 0.');
    }

    // 2. Registrar el movimiento en la auditoría
    await db.runAsync(
      `INSERT INTO inventory_movements
       (id, organization_id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [movementId, organizationId, userId, input.productId, input.type, input.quantity,
        input.reason, stockBefore, stockAfter, now]
    );

    const movPayload = JSON.stringify({
      id: movementId,
      organization_id: organizationId,
      owner_id: userId,
      product_id: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      stock_before: stockBefore,
      stock_after: stockAfter,
      created_at: now,
    });

    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'INSERT', 'inventory_movements', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, movementId, movPayload, now]
    );

    // 3. Actualizar el stock actual del producto
    await db.runAsync(
      `UPDATE products SET stock = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [stockAfter, now, input.productId, organizationId]
    );

    const productPayload = JSON.stringify({
      id: input.productId,
      organization_id: organizationId,
      stock: stockAfter,
      updated_at: now,
    });

    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'UPDATE', 'products', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, input.productId, productPayload, now]
    );
  });

  return movementId;
}

export async function getProductMovementsLocal(productId: string): Promise<InventoryMovement[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<InventoryMovement>(
    `SELECT * FROM inventory_movements
     WHERE product_id = ? AND organization_id = ? ORDER BY created_at DESC`,
    [productId, organizationId]
  );
}

export async function getAllMovementsLocal(): Promise<MovementWithProduct[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<MovementWithProduct>(`
    SELECT m.*, p.name as product_name
    FROM inventory_movements m
    JOIN products p ON m.product_id = p.id AND p.organization_id = m.organization_id
    WHERE m.organization_id = ?
    ORDER BY m.created_at DESC
  `, [organizationId]);
}
