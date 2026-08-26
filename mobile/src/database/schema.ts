export const CREATE_TABLES_QUERY = `
  PRAGMA foreign_keys = ON;

  -- 1. CATEGORÍAS
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 2. PRODUCTOS
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    type TEXT,
    price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
    cost REAL DEFAULT 0 CHECK (cost >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku TEXT UNIQUE,
    supplier TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  -- 3. IMÁGENES DE PRODUCTOS (Múltiples fotos)
  CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- 4. HISTORIAL DE MOVIMIENTOS
  CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('INITIAL_STOCK', 'PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  -- 5. VENTAS (Cabecera)
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
    notes TEXT,
    created_at TEXT NOT NULL
  );

  -- 6. DETALLE DE VENTAS (Items del carrito)
  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    subtotal REAL NOT NULL CHECK (subtotal >= 0)
  );

  -- 7. COLA DE SINCRONIZACIÓN (El corazón del Offline-First)
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
  );
`;