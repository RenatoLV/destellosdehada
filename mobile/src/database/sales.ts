import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';

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
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(sales)`);
    const columnNames = tableInfo.map(c => c.name);

    if (!columnNames.includes('client_id')) {
      await db.execAsync(`ALTER TABLE sales ADD COLUMN client_id TEXT;`);
    }
    if (!columnNames.includes('client_name')) {
      await db.execAsync(`ALTER TABLE sales ADD COLUMN client_name TEXT;`);
    }
  } catch (e) {
    console.warn('Error verificando columnas de sales:', e);
  }
}

export async function createSaleLocal(input: CreateSaleInput): Promise<string> {
  await ensureSalesColumns();
  const db = await getDatabase();
  const saleId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const discount = input.discount || 0;
    let rawTotal = 0;
    
    input.items.forEach(item => {
      rawTotal += (item.quantity * item.unitPrice);
    });
    
    const total = Math.max(0, rawTotal - discount);
    const clientId = input.clientId || null;
    const clientName = input.clientName || null;

    // 1. CREAR LA VENTA (Cabecera)
    await db.runAsync(
      `INSERT INTO sales (id, discount, total, notes, client_id, client_name, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [saleId, discount, total, input.notes || null, clientId, clientName, now]
    );

    const salePayload = JSON.stringify({
      id: saleId, 
      discount, 
      total, 
      notes: input.notes || null, 
      client_id: clientId,
      client_name: clientName,
      created_at: now
    });

    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'sales', ?, ?, ?)`,
      [Crypto.randomUUID(), saleId, salePayload, now]
    );

    // 2. PROCESAR CADA PRODUCTO VENDIDO
    for (const item of input.items) {
      const saleItemId = Crypto.randomUUID();
      const subtotal = item.quantity * item.unitPrice;

      await db.runAsync(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleItemId, saleId, item.productId, item.quantity, item.unitPrice, subtotal]
      );

      const saleItemPayload = JSON.stringify({
        id: saleItemId, 
        sale_id: saleId, 
        product_id: item.productId, 
        quantity: item.quantity, 
        unit_price: item.unitPrice, 
        subtotal
      });

      await db.runAsync(
        `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'sale_items', ?, ?, ?)`,
        [Crypto.randomUUID(), saleItemId, saleItemPayload, now]
      );

      // Descontar Stock
      const currentProduct: any = await db.getFirstAsync(
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

      const productUpdatePayload = JSON.stringify({
        id: item.productId, stock: stockAfter, updated_at: now
      });

      await db.runAsync(
        `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'UPDATE', 'products', ?, ?, ?)`,
        [Crypto.randomUUID(), item.productId, productUpdatePayload, now]
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

      await db.runAsync(
        `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'inventory_movements', ?, ?, ?)`,
        [Crypto.randomUUID(), movementId, movPayload, now]
      );
    }
  });

  return saleId;
}

export async function getSalesLocal() {
  await ensureSalesColumns();
  const db = await getDatabase();
  return await db.getAllAsync(`
    SELECT s.*, 
           (SELECT p.name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = s.id LIMIT 1) as first_product_name,
           (SELECT count(*) FROM sale_items si WHERE si.sale_id = s.id) as total_items
    FROM sales s
    ORDER BY s.created_at DESC
  `);
}
