-- Sales/POS security boundary.
-- Products/categories remain read-only in this app; transactional data belongs to auth.uid().
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- The initial migration used open authenticated policies. Replace them with the
-- Sales app boundary. Admin writes must happen in the Admin app/backend role.
DROP POLICY IF EXISTS "auth_select_categories" ON public.categories;
DROP POLICY IF EXISTS "auth_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "auth_update_categories" ON public.categories;
DROP POLICY IF EXISTS "auth_select_products" ON public.products;
DROP POLICY IF EXISTS "auth_insert_products" ON public.products;
DROP POLICY IF EXISTS "auth_update_products" ON public.products;
DROP POLICY IF EXISTS "auth_select_product_images" ON public.product_images;
DROP POLICY IF EXISTS "auth_insert_product_images" ON public.product_images;
DROP POLICY IF EXISTS "auth_update_product_images" ON public.product_images;
DROP POLICY IF EXISTS "auth_select_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "auth_insert_inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "auth_select_sales" ON public.sales;
DROP POLICY IF EXISTS "auth_insert_sales" ON public.sales;
DROP POLICY IF EXISTS "auth_select_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "auth_insert_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "auth_select_clients" ON public.clients;
DROP POLICY IF EXISTS "auth_insert_clients" ON public.clients;
DROP POLICY IF EXISTS "auth_update_clients" ON public.clients;

CREATE POLICY "sales_read_categories" ON public.categories
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "sales_read_products" ON public.products
  FOR SELECT TO authenticated USING (owner_id = auth.uid() AND active = 1 AND deleted_at IS NULL);
CREATE POLICY "sales_read_product_images" ON public.product_images
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "sales_read_clients" ON public.clients
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "sales_insert_clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "sales_update_clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "sales_read_sales" ON public.sales
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "sales_read_sale_items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.owner_id = auth.uid()));

CREATE POLICY "sales_read_movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_categories_owner_updated_at
  ON public.categories(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_products_owner_active_updated_at
  ON public.products(owner_id, active, updated_at);
CREATE INDEX IF NOT EXISTS idx_product_images_owner_product
  ON public.product_images(owner_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_owner_created_at
  ON public.sales(owner_id, created_at);

-- Private bucket for future transfer receipts. Files must be stored below
-- <auth.uid()>/<sale-id>/ so the object policy can enforce ownership.
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "authenticated_read_receipts" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_receipts" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_receipts" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_receipts" ON storage.objects;

CREATE POLICY "authenticated_read_receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "authenticated_upload_receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "authenticated_update_receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "authenticated_delete_receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Atomic server-side sale. This is called by the Edge Function using the
-- caller JWT; no service-role key is used by the client or function.
CREATE OR REPLACE FUNCTION public.process_sale(p_sale JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sale_id TEXT := p_sale->>'id';
  v_existing_owner UUID;
  v_discount INTEGER := COALESCE((p_sale->>'discount')::INTEGER, 0);
  v_total INTEGER := 0;
  v_item RECORD;
  v_product RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_sale_id IS NULL OR jsonb_typeof(p_sale->'items') <> 'array' OR jsonb_array_length(p_sale->'items') = 0 THEN
    RAISE EXCEPTION 'invalid_sale_payload' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_sale->'items') AS duplicate_check(product_id TEXT)
    GROUP BY product_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_product_in_sale' USING ERRCODE = '22023';
  END IF;

  SELECT owner_id INTO v_existing_owner FROM public.sales WHERE id = v_sale_id;
  IF v_existing_owner IS NOT NULL THEN
    IF v_existing_owner <> v_user_id THEN
      RAISE EXCEPTION 'sale_owned_by_another_user' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('status', 'already_processed', 'sale_id', v_sale_id);
  END IF;

  IF v_discount < 0 THEN
    RAISE EXCEPTION 'invalid_discount' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_sale->'items') AS x(
      id TEXT, product_id TEXT, quantity INTEGER, unit_price INTEGER
    )
  LOOP
    IF v_item.id IS NULL OR v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 OR v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'invalid_sale_item' USING ERRCODE = '22023';
    END IF;

    SELECT id, owner_id, price, stock, active, deleted_at INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_product.owner_id IS DISTINCT FROM v_user_id OR v_product.active <> 1 OR v_product.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'product_not_available:%', v_item.product_id USING ERRCODE = 'P0002';
    END IF;
    IF v_item.unit_price <> v_product.price THEN
      RAISE EXCEPTION 'stale_product_price:%', v_item.product_id USING ERRCODE = 'P0001';
    END IF;
    IF v_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'insufficient_stock:%', v_item.product_id USING ERRCODE = 'P0001';
    END IF;

    v_total := v_total + (v_item.quantity * v_item.unit_price);
  END LOOP;

  IF v_discount > v_total THEN
    RAISE EXCEPTION 'discount_exceeds_total' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sales (id, owner_id, discount, total, notes, client_id, client_name, created_at)
  VALUES (
    v_sale_id, v_user_id, v_discount, v_total - v_discount,
    NULLIF(p_sale->>'notes', ''), NULLIF(p_sale->>'client_id', '')::TEXT,
    NULLIF(p_sale->>'client_name', ''), COALESCE((p_sale->>'created_at')::TIMESTAMPTZ, NOW())
  );

  IF NULLIF(p_sale->>'client_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients WHERE id = p_sale->>'client_id' AND owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'client_not_owned' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_sale->'items') AS x(
      id TEXT, product_id TEXT, quantity INTEGER, unit_price INTEGER
    )
  LOOP
    SELECT stock INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    INSERT INTO public.sale_items (id, sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_item.id, v_sale_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    UPDATE public.products
    SET stock = stock - v_item.quantity, updated_at = NOW()
    WHERE id = v_item.product_id AND stock >= v_item.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_stock:%', v_item.product_id USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.inventory_movements (id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
    VALUES (uuid_generate_v4()::TEXT, v_user_id, v_item.product_id, 'SALE', -v_item.quantity, 'Venta POS', v_product.stock, v_product.stock - v_item.quantity, NOW());
  END LOOP;

  RETURN jsonb_build_object('status', 'created', 'sale_id', v_sale_id, 'total', v_total - v_discount);
END;
$$;

REVOKE ALL ON FUNCTION public.process_sale(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_sale(JSONB) TO authenticated;
