import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';

// Interfaz adaptada para soportar "carritos" con múltiples productos
export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number; // INTEGER
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  discount?: number; // INTEGER
  notes?: string;
}

export async function createSaleLocal(input: CreateSaleInput): Promise<string> {
  const db = await getDatabase();
  const saleId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    
    // 1. Calcular el total (Suma de subtotales - descuento)
    const discount = input.discount || 0;
    let rawTotal = 0;
    
    input.items.forEach(item => {
      rawTotal += (item.quantity * item.unitPrice);
    });
    
    const total = Math.max(0, rawTotal - discount);

    // ==========================================
    // 2. CREAR LA VENTA (Cabecera)
    // ==========================================
    await db.runAsync(
      `INSERT INTO sales (id, discount, total, notes, created_at) VALUES (?, ?, ?, ?, ?)`,
      [saleId, discount, total, input.notes || null, now]
    );

    const salePayload = JSON.stringify({
      id: saleId, discount, total, notes: input.notes || null, created_at: now
    });

    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'sales', ?, ?, ?)`,
      [Crypto.randomUUID(), saleId, salePayload, now]
    );

    // ==========================================
    // 3. PROCESAR CADA PRODUCTO VENDIDO
    // ==========================================
    for (const item of input.items) {
      const saleItemId = Crypto.randomUUID();
      const subtotal = item.quantity * item.unitPrice;

      // A. Insertar Item de Venta
      await db.runAsync(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleItemId, saleId, item.productId, item.quantity, item.unitPrice, subtotal]
      );

      const saleItemPayload = JSON.stringify({
        id: saleItemId, sale_id: saleId, product_id: item.productId, 
        quantity: item.quantity, unit_price: item.unitPrice, subtotal
      });

      await db.runAsync(
        `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at) VALUES (?, 'INSERT', 'sale_items', ?, ?, ?)`,
        [Crypto.randomUUID(), saleItemId, saleItemPayload, now]
      );

      // B. Consultar el stock actual del producto (Protección)
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

      // C. Actualizar Stock del Producto
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

      // D. Crear Movimiento de Inventario
      const movementId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO inventory_movements (id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
         VALUES (?, ?, 'SALE', ?, ?, ?, ?, ?)`,
        [movementId, item.productId, -item.quantity, `Venta registrada (Ref: ${saleId.substring(0,6)})`, stockBefore, stockAfter, now]
      );

      const movPayload = JSON.stringify({
        id: movementId, product_id: item.productId, type: 'SALE', quantity: -item.quantity,
        reason: `Venta registrada`, stock_before: stockBefore, stock_after: stockAfter, created_at: now
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
  const db = await getDatabase();
  // Traemos las ventas y hacemos un JOIN para obtener el nombre del primer producto de esa venta
  // (Esto es útil para la pantalla de historial de ventas)
  return await db.getAllAsync(`
    SELECT s.*, 
           (SELECT p.name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = s.id LIMIT 1) as first_product_name,
           (SELECT count(*) FROM sale_items si WHERE si.sale_id = s.id) as total_items
    FROM sales s
    ORDER BY s.created_at DESC
  `);
}