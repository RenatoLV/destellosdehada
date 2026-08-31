import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Product, SaleItem, SaleSummary, SaleTransactionPayload } from '../types/database';

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

async function ensureSalesColumns(): Promise<void> {
  const db = await getDatabase();
  const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(sales)`);
  const columnNames = tableInfo.map(c => c.name);

  // Algunas bases web antiguas devuelven el PRAGMA sin las columnas recién
  // agregadas. SQLite considera esto idempotente si ignoramos el duplicado.
  for (const column of ['client_id', 'client_name']) {
    if (columnNames.includes(column)) continue;
    try {
      await db.execAsync(`ALTER TABLE sales ADD COLUMN ${column} TEXT;`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('duplicate column')) {
        throw error;
      }
    }
  }
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
  await ensureSalesColumns();
  const db = await getDatabase();
  const saleId = Crypto.randomUUID();
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
      `INSERT INTO sales (id, discount, total, notes, client_id, client_name, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [saleId, discount, total, input.notes || null, clientId, clientName, now]
    );

    // 2. PROCESAR CADA PRODUCTO VENDIDO
    for (const item of input.items) {
      const saleItemId = Crypto.randomUUID();
      const subtotal = item.quantity * item.unitPrice;

      const saleItem = {
        id: saleItemId,
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal,
      } satisfies SaleItem;
      saleItems.push(saleItem);

      await db.runAsync(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleItemId, saleId, item.productId, item.quantity, item.unitPrice, subtotal]
      );

      // Descontar Stock
      const currentProduct = await db.getFirstAsync<Pick<Product, 'stock'>>(
        `SELECT stock FROM products WHERE id = ?`, 
        [item.productId]
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
        `UPDATE products SET stock = ?, updated_at = ? WHERE id = ?`,
        [stockAfter, now, item.productId]
      );

      // Movimiento de Inventario
      const movementId = Crypto.randomUUID();
      const reasonText = clientName 
        ? `Venta a ${clientName} (Ref: ${saleId.substring(0,6)})`
        : `Venta rápida (Ref: ${saleId.substring(0,6)})`;

      await db.runAsync(
        `INSERT INTO inventory_movements (id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, 'SALE', ?, ?, ?, ?, ?)`,
        [movementId, item.productId, -item.quantity, reasonText, stockBefore, stockAfter, now]
      );

      const movPayload = JSON.stringify({
        id: movementId, 
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
      discount,
      total,
      notes: input.notes?.trim() || null,
      client_id: clientId,
      client_name: clientName,
      created_at: now,
      items: saleItems,
    };
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'sale_transactions', ?, ?, ?)`,
      [Crypto.randomUUID(), saleId, JSON.stringify(transaction), now]
    );
  });

  return saleId;
}

export async function getSalesLocal(): Promise<SaleSummary[]> {
  await ensureSalesColumns();
  const db = await getDatabase();
  return await db.getAllAsync<SaleSummary>(`
    SELECT s.*, 
           (SELECT p.name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = s.id LIMIT 1) as first_product_name,
           (SELECT count(*) FROM sale_items si WHERE si.sale_id = s.id) as total_items,
           (SELECT status FROM sync_queue q WHERE q.entity = 'sale_transactions' AND q.entity_id = s.id
            ORDER BY q.created_at DESC, q.id DESC LIMIT 1) as sync_status
    FROM sales s
    ORDER BY s.created_at DESC
  `);
}
