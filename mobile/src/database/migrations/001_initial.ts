import { SQLiteDatabase } from 'expo-sqlite';

export async function applyMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );

      -- Categoría por defecto para evitar errores de Foreign Key
      INSERT OR IGNORE INTO categories (id, name) VALUES ('cat_general', 'General');

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
        type TEXT,
        price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
        cost INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        sku TEXT UNIQUE,
        supplier TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS product_images (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        local_uri TEXT,
        storage_path TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        type TEXT NOT NULL CHECK (type IN ('INITIAL_STOCK', 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT')),
        quantity INTEGER NOT NULL,
        reason TEXT NOT NULL,
        stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
        stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
        total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY NOT NULL,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
        subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'synced', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      PRAGMA user_version = 1;
    `);
  }
}