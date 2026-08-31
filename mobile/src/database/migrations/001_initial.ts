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
        client_id TEXT,
        client_name TEXT,
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

  if (currentVersion < 2) {
    const queueColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_queue)');
    const queueColumnNames = queueColumns.map(column => column.name);
    if (!queueColumnNames.includes('processed_at')) {
      await db.execAsync('ALTER TABLE sync_queue ADD COLUMN processed_at TEXT');
    }
    if (!queueColumnNames.includes('retry_at')) {
      await db.execAsync('ALTER TABLE sync_queue ADD COLUMN retry_at TEXT');
    }
    if (!queueColumnNames.includes('updated_at')) {
      // SQLite no permite expresiones no constantes como DEFAULT al agregar
      // columnas. Se agrega nullable, se rellena desde created_at y las nuevas
      // escrituras siempre envían updated_at explícitamente.
      await db.execAsync('ALTER TABLE sync_queue ADD COLUMN updated_at TEXT');
      await db.execAsync('UPDATE sync_queue SET updated_at = created_at WHERE updated_at IS NULL');
    }
    const clientColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(clients)');
    if (clientColumns.length > 0 && !clientColumns.some(column => column.name === 'owner_id')) {
      await db.execAsync('ALTER TABLE clients ADD COLUMN owner_id TEXT');
    }
    await db.execAsync('PRAGMA user_version = 2');
  }

  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        rut TEXT,
        notes TEXT,
        owner_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
      CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, active, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_ready
        ON sync_queue(status, retry_at, attempts, created_at);
      CREATE INDEX IF NOT EXISTS idx_clients_owner_updated_at
        ON clients(owner_id, updated_at);
    `);
    await db.execAsync('PRAGMA user_version = 3');
  }

  if (currentVersion < 4) {
    const categoryColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)');
    if (!categoryColumns.some(column => column.name === 'owner_id')) {
      await db.execAsync('ALTER TABLE categories ADD COLUMN owner_id TEXT');
    }
    const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
    if (!productColumns.some(column => column.name === 'owner_id')) {
      await db.execAsync('ALTER TABLE products ADD COLUMN owner_id TEXT');
    }
    const imageColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(product_images)');
    if (!imageColumns.some(column => column.name === 'owner_id')) {
      await db.execAsync('ALTER TABLE product_images ADD COLUMN owner_id TEXT');
    }
    await db.execAsync('PRAGMA user_version = 4');
  }
}
