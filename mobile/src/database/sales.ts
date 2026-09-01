import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Product, Sale, SaleItem, SaleSummary, SaleTransactionPayload } from '../types/database';
import { getCurrentOrganizationId, getCurrentUserId } from '../services/organizationContext';

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  discount?: number;
  notes?: string;
  clientId?: string | null;
  clientName?: string | null;
}

export async function createSaleLocal(input: CreateSaleInput): Promise<string> {
  if (!input.items.length || input.items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || item.unitPrice < 0)) {
    throw new Error('La venta debe contener productos y cantidades válidas.');
  }
  if (new Set(input.items.map(item => item.productId)).size !== input.items.length) {
    throw new Error('No se puede repetir un producto dentro de la misma venta.');
  }
  if (input.discount !== undefined && (!Number.isFinite(input.discount) || input.discount < 0)) {
    throw new Error('El descuento no es válido.');
  }
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const saleId = Crypto.randomUUID();
  const localPaymentId = Crypto.randomUUID();
  const idempotencyKey = Crypto.randomUUID();
  const now = new Date().toISOString();
  const saleItems: SaleItem[] = [];

  await db.withTransactionAsync(async () => {
    const discount = input.discount || 0;
    let rawTotal = 0;
    
    input.items.forEach(item => {
      rawTotal += (item.quantity * item.unitPrice);
    });
    
    const total = Math.max(0, rawTotal - discount);
    if (discount > rawTotal) {
      throw new Error('El descuento no puede superar el subtotal.');
    }
    const clientId = input.clientId || null;
    const clientName = input.clientName || null;

    // 1. CREAR LA VENTA (Cabecera)
    await db.runAsync(
      `INSERT INTO sales
       (id, organization_id, created_by, owner_id, local_payment_id, discount, total, notes,
        client_id, client_name, status, idempotency_key, payload_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [saleId, organizationId, userId, userId, localPaymentId, discount, total, input.notes || null,
        clientId, clientName, idempotencyKey, null, now]
    );

    await db.runAsync(
      `INSERT INTO payments
       (id, organization_id, sale_id, method, status, amount, reference, created_at)
       VALUES (?, ?, ?, 'transfer', 'pending', ?, NULL, ?)`,
      [localPaymentId, organizationId, saleId, total, now],
    );

    // 2. PROCESAR CADA PRODUCTO VENDIDO
    for (const item of input.items) {
      const saleItemId = Crypto.randomUUID();
      const subtotal = item.quantity * item.unitPrice;

      const saleItem = {
        id: saleItemId,
        organization_id: organizationId,
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal,
      } satisfies SaleItem;
      saleItems.push(saleItem);

      await db.runAsync(
        `INSERT INTO sale_items
         (id, organization_id, sale_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [saleItemId, organizationId, saleId, item.productId, item.quantity, item.unitPrice, subtotal]
      );

      // Descontar Stock
      const currentProduct = await db.getFirstAsync<Pick<Product, 'stock'>>(
        `SELECT stock FROM products
         WHERE id = ? AND organization_id = ? AND active = 1 AND deleted_at IS NULL`,
        [item.productId, organizationId]
      );

      if (!currentProduct) {
        throw new Error(`Producto no encontrado (ID: ${item.productId})`);
      }

      const stockBefore = currentProduct.stock;
      const stockAfter = stockBefore - item.quantity;

      if (stockAfter < 0) {
        throw new Error(`Stock insuficiente para vender ${item.quantity} unidades.`);
      }

      await db.runAsync(
        `UPDATE products SET stock = ?, pending_stock_delta = COALESCE(pending_stock_delta, 0) - ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [stockAfter, item.quantity, now, item.productId, organizationId]
      );

      // Movimiento de Inventario
      const movementId = Crypto.randomUUID();
      const reasonText = clientName 
        ? `Venta a ${clientName} (Ref: ${saleId.substring(0,6)})`
        : `Venta rápida (Ref: ${saleId.substring(0,6)})`;

      await db.runAsync(
        `INSERT INTO inventory_movements
         (id, organization_id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, ?, ?, 'SALE', ?, ?, ?, ?, ?)`,
        [movementId, organizationId, userId, item.productId, -item.quantity, reasonText, stockBefore, stockAfter, now]
      );

      const movPayload = JSON.stringify({
        id: movementId, 
        organization_id: organizationId,
        user_id: userId,
        product_id: item.productId, 
        type: 'SALE', 
        quantity: -item.quantity,
        reason: reasonText, 
        stock_before: stockBefore, 
        stock_after: stockAfter, 
        created_at: now
      });

    }

    const transaction: SaleTransactionPayload = {
      id: saleId,
      organization_id: organizationId,
      created_by: userId,
      discount,
      total,
      notes: input.notes?.trim() || null,
      client_id: clientId,
      client_name: clientName,
      created_at: now,
      idempotency_key: idempotencyKey,
      items: saleItems,
    };
    const payloadHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify(transaction),
    );
    transaction.payload_hash = payloadHash;
    await db.runAsync(
      `UPDATE sales SET payload_hash = ? WHERE id = ? AND organization_id = ?`,
      [payloadHash, saleId, organizationId],
    );
    const clientDependency = clientId
      ? await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sync_queue
         WHERE organization_id = ? AND entity = 'clients' AND entity_id = ?
           AND status IN ('pending', 'processing', 'failed')
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [organizationId, clientId],
      )
      : null;
    const dependencies = clientDependency ? JSON.stringify([clientDependency.id]) : null;
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, depends_on, created_at)
       VALUES (?, ?, ?, 'INSERT', 'sale_transactions', ?, ?, ?, ?, ?)`,
      [Crypto.randomUUID(), organizationId, userId, saleId, JSON.stringify(transaction), idempotencyKey, dependencies, now]
    );
  });

  return saleId;
}

export async function getSalesLocal(): Promise<SaleSummary[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<SaleSummary>(`
    SELECT s.*, 
           (SELECT p.name FROM sale_items si JOIN products p
            ON si.product_id = p.id AND p.organization_id = si.organization_id
            WHERE si.sale_id = s.id AND si.organization_id = s.organization_id LIMIT 1) as first_product_name,
           (SELECT count(*) FROM sale_items si
            WHERE si.sale_id = s.id AND si.organization_id = s.organization_id) as total_items,
           (SELECT status FROM sync_queue q WHERE q.entity = 'sale_transactions'
            AND q.entity_id = s.id AND q.organization_id = s.organization_id
            ORDER BY q.created_at DESC, q.id DESC LIMIT 1) as sync_status
    FROM sales s
    WHERE s.organization_id = ?
    ORDER BY s.created_at DESC
  `, [organizationId]);
}

export async function getSaleLocal(saleId: string): Promise<Sale | null> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  const sale = await db.getFirstAsync<Sale>(
    `SELECT * FROM sales WHERE id = ? AND organization_id = ?`,
    [saleId, organizationId],
  );
  return sale ?? null;
}
