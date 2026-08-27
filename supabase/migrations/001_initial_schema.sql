-- =============================================================
-- DESTELLOS DE HADA - Schema Supabase (destellosdehadajoyas)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   TEXT REFERENCES public.categories(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

INSERT INTO public.categories (id, name, created_at, updated_at)
VALUES ('cat_general', 'General', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. PRODUCTOS
CREATE TABLE IF NOT EXISTS public.products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES public.categories(id) ON DELETE RESTRICT,
  type        TEXT,
  price       INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost        INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku         TEXT UNIQUE,
  supplier    TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- 3. IMAGENES DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.product_images (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  local_uri    TEXT,
  storage_path TEXT,
  is_primary   INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MOVIMIENTOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  type         TEXT NOT NULL CHECK (type IN ('INITIAL_STOCK','PURCHASE','SALE','RETURN','ADJUSTMENT')),
  quantity     INTEGER NOT NULL,
  reason       TEXT,
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after  INTEGER NOT NULL CHECK (stock_after >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  rut         TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- 6. VENTAS
CREATE TABLE IF NOT EXISTS public.sales (
  id          TEXT PRIMARY KEY,
  discount    INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total       INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes       TEXT,
  client_id   TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ITEMS DE VENTA
CREATE TABLE IF NOT EXISTS public.sale_items (
  id         TEXT PRIMARY KEY,
  sale_id    TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  subtotal   INTEGER NOT NULL CHECK (subtotal >= 0)
);

-- 7. RLS - Row Level Security (Acceso solo autenticado)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Politicas: solo usuarios autenticados pueden leer/escribir
CREATE POLICY "auth_select_categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_categories" ON public.categories FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_select_products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_products" ON public.products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_select_product_images" ON public.product_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_product_images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_product_images" ON public.product_images FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_select_inventory_movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_inventory_movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select_sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select_sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select_clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_clients" ON public.clients FOR UPDATE TO authenticated USING (true);
