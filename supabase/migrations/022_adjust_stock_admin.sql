-- Ajustes administrativos de stock atómicos, auditados e idempotentes.
-- Evita que Mobile escriba directamente inventory_movements o deje stock sin trazabilidad.

CREATE OR REPLACE FUNCTION public.adjust_stock_admin(
  p_organization_id UUID,
  p_movement JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_movement_id TEXT := NULLIF(btrim(p_movement->>'id'), '');
  v_product_id TEXT := NULLIF(btrim(p_movement->>'product_id'), '');
  v_type TEXT := COALESCE(NULLIF(btrim(p_movement->>'type'), ''), 'ADJUSTMENT');
  v_reason TEXT := NULLIF(btrim(p_movement->>'reason'), '');
  v_quantity INTEGER;
  v_stock_before INTEGER;
  v_stock_after INTEGER;
  v_product public.products%ROWTYPE;
  v_existing public.inventory_movements%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF p_organization_id IS NULL OR p_movement IS NULL
     OR v_movement_id IS NULL OR v_product_id IS NULL OR v_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD');
  END IF;
  IF NOT public.is_organization_admin(p_organization_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ADMIN_REQUIRED');
  END IF;
  IF v_type NOT IN ('PURCHASE', 'RETURN', 'ADJUSTMENT') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_MOVEMENT_TYPE');
  END IF;

  BEGIN
    v_quantity := (p_movement->>'quantity')::INTEGER;
    v_stock_before := (p_movement->>'stock_before')::INTEGER;
    v_stock_after := (p_movement->>'stock_after')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_NUMERIC_VALUE');
  END;

  IF v_quantity = 0 OR v_stock_before < 0 OR v_stock_after < 0
     OR v_stock_after <> v_stock_before + v_quantity THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STOCK_ADJUSTMENT');
  END IF;

  SELECT * INTO v_existing
  FROM public.inventory_movements
  WHERE id = v_movement_id;

  IF FOUND THEN
    IF v_existing.organization_id = p_organization_id
       AND v_existing.product_id = v_product_id
       AND v_existing.type = v_type
       AND v_existing.quantity = v_quantity
       AND v_existing.reason IS NOT DISTINCT FROM v_reason
       AND v_existing.stock_before = v_stock_before
       AND v_existing.stock_after = v_stock_after THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'movement_id', v_existing.id,
        'stock', v_existing.stock_after
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'MOVEMENT_PAYLOAD_MISMATCH');
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_product_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_NOT_FOUND');
  END IF;
  IF v_product.stock <> v_stock_before THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'STOCK_CHANGED',
      'current_stock', v_product.stock
    );
  END IF;

  UPDATE public.products
  SET stock = v_stock_after,
      updated_at = NOW()
  WHERE id = v_product_id
    AND organization_id = p_organization_id
    AND stock = v_stock_before;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'STOCK_CHANGED');
  END IF;

  INSERT INTO public.inventory_movements (
    id, organization_id, owner_id, product_id, type, quantity, reason,
    stock_before, stock_after, created_at
  ) VALUES (
    v_movement_id, p_organization_id, v_user_id, v_product_id, v_type,
    v_quantity, v_reason, v_stock_before, v_stock_after,
    COALESCE(NULLIF(p_movement->>'created_at', '')::TIMESTAMPTZ, NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'movement_id', v_movement_id,
    'stock', v_stock_after
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'MOVEMENT_UNIQUE_CONFLICT');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'INTERNAL_ERROR');
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stock_admin(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_admin(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.adjust_stock_admin(UUID, JSONB) IS
  'Aplica un ajuste de stock administrativo con bloqueo, auditoría e idempotencia por movement id.';
