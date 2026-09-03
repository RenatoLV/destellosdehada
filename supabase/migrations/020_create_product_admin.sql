-- Alta administrativa de productos con stock inicial auditado e idempotente.
-- La identidad siempre proviene de auth.uid() y la autorización de memberships.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.create_product_admin(
  p_organization_id UUID,
  p_product JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product_id TEXT := NULLIF(btrim(p_product->>'id'), '');
  v_name TEXT := NULLIF(btrim(p_product->>'name'), '');
  v_category_id TEXT := NULLIF(btrim(p_product->>'category_id'), '');
  v_sku TEXT := NULLIF(btrim(p_product->>'sku'), '');
  v_price INTEGER;
  v_cost INTEGER;
  v_stock INTEGER;
  v_movement_id TEXT := NULLIF(btrim(p_product->>'initial_movement_id'), '');
  v_existing public.products%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF p_organization_id IS NULL OR p_product IS NULL OR v_product_id IS NULL OR v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD');
  END IF;
  IF NOT public.is_organization_admin(p_organization_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ADMIN_REQUIRED');
  END IF;

  BEGIN
    v_price := COALESCE(NULLIF(p_product->>'price', '')::INTEGER, 0);
    v_cost := COALESCE(NULLIF(p_product->>'cost', '')::INTEGER, 0);
    v_stock := COALESCE(NULLIF(p_product->>'stock', '')::INTEGER, 0);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_NUMERIC_VALUE');
  END;
  IF v_price < 0 OR v_cost < 0 OR v_stock < 0 OR char_length(v_name) > 180 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PRODUCT_VALUES');
  END IF;
  IF v_stock > 0 AND v_movement_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INITIAL_MOVEMENT_REQUIRED');
  END IF;
  IF v_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = v_category_id AND organization_id = p_organization_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'CATEGORY_NOT_FOUND');
  END IF;

  SELECT * INTO v_existing FROM public.products WHERE id = v_product_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.organization_id = p_organization_id
       AND v_existing.name = v_name
       AND v_existing.price = v_price
       AND v_existing.cost = v_cost
       AND v_existing.stock = v_stock
       AND v_existing.category_id IS NOT DISTINCT FROM v_category_id
       AND v_existing.sku IS NOT DISTINCT FROM v_sku THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true, 'product_id', v_existing.id
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_PAYLOAD_MISMATCH');
  END IF;

  IF v_sku IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
    RETURN jsonb_build_object('success', false, 'code', 'SKU_ALREADY_EXISTS');
  END IF;

  INSERT INTO public.products (
    id, organization_id, owner_id, name, description, category_id, type,
    price, cost, stock, sku, supplier, active, created_at, updated_at
  ) VALUES (
    v_product_id, p_organization_id, v_user_id, v_name,
    NULLIF(p_product->>'description', ''), v_category_id,
    NULLIF(p_product->>'type', ''), v_price, v_cost, v_stock, v_sku,
    NULLIF(p_product->>'supplier', ''), 1,
    COALESCE(NULLIF(p_product->>'created_at', '')::TIMESTAMPTZ, NOW()), NOW()
  );

  IF v_stock > 0 THEN
    INSERT INTO public.inventory_movements (
      id, organization_id, owner_id, product_id, type, quantity, reason,
      stock_before, stock_after, created_at
    ) VALUES (
      v_movement_id, p_organization_id, v_user_id, v_product_id,
      'INITIAL_STOCK', v_stock, 'Inventario inicial', 0, v_stock, NOW()
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'product_id', v_product_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_UNIQUE_CONFLICT');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'INTERNAL_ERROR');
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_admin(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_admin(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_product_admin(UUID, JSONB) IS
  'Crea un producto y su movimiento INITIAL_STOCK de forma atómica para owners/admins.';
