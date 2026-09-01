-- FASE 6: huella canónica server-side y recuperación por idempotency_key.
-- payload_hash se conserva como huella declarada por el cliente para
-- compatibilidad/auditoría. server_payload_hash es la autoridad del backend.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS server_payload_hash TEXT;

CREATE OR REPLACE FUNCTION public.sale_server_payload_hash(
  p_sale JSONB,
  p_organization_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonical JSONB;
BEGIN
  IF p_sale IS NULL OR p_organization_id IS NULL
     OR jsonb_typeof(p_sale->'items') <> 'array' THEN
    RETURN NULL;
  END IF;

  v_canonical := jsonb_build_object(
    'organization_id', p_organization_id::TEXT,
    'client_id', NULLIF(p_sale->>'client_id', ''),
    'discount', COALESCE(NULLIF(p_sale->>'discount', '')::INTEGER, 0),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', item->>'product_id',
          'quantity', (item->>'quantity')::INTEGER
        )
        ORDER BY item->>'product_id', item->>'quantity'
      )
      FROM jsonb_array_elements(p_sale->'items') AS item
    ), '[]'::JSONB)
  );

  RETURN encode(digest(v_canonical::TEXT, 'sha256'), 'hex');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sale_server_payload_hash(JSONB, UUID) FROM PUBLIC, anon, authenticated;

-- Backfill the server fingerprint for sales created by migration 013.
UPDATE public.sales AS sale
SET server_payload_hash = public.sale_server_payload_hash(
  jsonb_build_object(
    'client_id', sale.client_id,
    'discount', sale.discount,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('product_id', item.product_id, 'quantity', item.quantity)
        ORDER BY item.product_id, item.quantity
      )
      FROM public.sale_items AS item
      WHERE item.sale_id = sale.id
        AND item.organization_id = sale.organization_id
    ), '[]'::JSONB)
  ),
  sale.organization_id
)
WHERE sale.server_payload_hash IS NULL
  AND sale.organization_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_sale(
  p_sale             JSONB,
  p_organization_id  UUID,
  p_idempotency_key  TEXT,
  p_payload_hash     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sale_id TEXT := NULLIF(p_sale->>'id', '');
  v_existing RECORD;
  v_item RECORD;
  v_product RECORD;
  v_total INTEGER := 0;
  v_discount INTEGER;
  v_client_id TEXT := NULLIF(p_sale->>'client_id', '');
  v_payment_id TEXT := gen_random_uuid()::TEXT;
  v_payment_amount INTEGER;
  v_created_at TIMESTAMPTZ;
  v_server_payload_hash TEXT;
  v_error TEXT;
  v_error_code TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'message', 'La sesión autenticada es obligatoria.', 'sale_id', NULL);
  END IF;
  IF p_organization_id IS NULL OR p_idempotency_key IS NULL
     OR btrim(p_idempotency_key) = '' OR p_payload_hash IS NULL
     OR btrim(p_payload_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'Faltan datos obligatorios de contexto o idempotencia.', 'sale_id', NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_organization_id AND user_id = v_user_id AND active = TRUE
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ORGANIZATION_MEMBER',
      'message', 'El usuario no pertenece activamente a la organización.', 'sale_id', NULL);
  END IF;
  IF v_sale_id IS NULL OR jsonb_typeof(p_sale->'items') <> 'array'
     OR jsonb_array_length(p_sale->'items') = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'La venta debe contener un id y al menos un item.', 'sale_id', NULL);
  END IF;

  v_discount := COALESCE(NULLIF(p_sale->>'discount', '')::INTEGER, 0);
  IF v_discount < 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'El descuento no puede ser negativo.', 'sale_id', NULL);
  END IF;
  v_server_payload_hash := public.sale_server_payload_hash(p_sale, p_organization_id);
  IF v_server_payload_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'No fue posible canonicalizar el payload de venta.', 'sale_id', NULL);
  END IF;

  SELECT id, organization_id, idempotency_key, payload_hash,
         server_payload_hash, status
    INTO v_existing
  FROM public.sales
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.server_payload_hash IS NULL THEN
      IF v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN
        RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          'message', 'La idempotency_key ya fue utilizada con otro payload.', 'sale_id', NULL);
      END IF;
      UPDATE public.sales SET server_payload_hash = v_server_payload_hash WHERE id = v_existing.id;
    ELSIF v_existing.server_payload_hash IS DISTINCT FROM v_server_payload_hash THEN
      RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'message', 'La idempotency_key ya fue utilizada con otro payload.', 'sale_id', NULL);
    END IF;
    IF v_existing.status IN ('rejected', 'conflict') THEN
      RETURN jsonb_build_object('success', false, 'code', 'SALE_ALREADY_REJECTED',
        'message', 'La venta ya fue rechazada y no puede reabrirse.', 'sale_id', v_existing.id);
    END IF;
    SELECT id INTO v_payment_id FROM public.payments
    WHERE organization_id = p_organization_id AND sale_id = v_existing.id;
    RETURN jsonb_build_object('success', true, 'idempotent', true,
      'sale_id', v_existing.id, 'payment_id', v_payment_id, 'status', v_existing.status,
      'server_payload_hash', v_server_payload_hash);
  END IF;

  IF EXISTS (SELECT 1 FROM public.sales WHERE id = v_sale_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'message', 'El identificador de venta ya existe.', 'sale_id', NULL);
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_sale->'items') AS duplicate_check(product_id TEXT)
    GROUP BY product_id HAVING COUNT(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'No se puede repetir un producto dentro de la venta.', 'sale_id', NULL);
  END IF;
  IF v_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = v_client_id AND organization_id = p_organization_id AND deleted_at IS NULL
  ) THEN
    IF EXISTS (SELECT 1 FROM public.clients WHERE id = v_client_id) THEN
      RETURN jsonb_build_object('success', false, 'code', 'ORGANIZATION_MISMATCH',
        'message', 'El cliente pertenece a otra organización.', 'sale_id', NULL);
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'CLIENT_NOT_FOUND',
      'message', 'El cliente no existe en la organización.', 'sale_id', NULL);
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_sale->'items') AS item(
      id TEXT, product_id TEXT, quantity INTEGER, unit_price INTEGER
    ) ORDER BY product_id
  LOOP
    IF v_item.id IS NULL OR v_item.product_id IS NULL
       OR v_item.quantity IS NULL OR v_item.quantity <= 0
       OR v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
        'message', 'El item contiene cantidad o precio inválido.', 'sale_id', NULL);
    END IF;
    SELECT id, organization_id, price, stock, active, deleted_at INTO v_product
    FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_NOT_FOUND',
        'message', 'El producto no existe.', 'sale_id', NULL);
    END IF;
    IF v_product.organization_id IS DISTINCT FROM p_organization_id THEN
      RETURN jsonb_build_object('success', false, 'code', 'ORGANIZATION_MISMATCH',
        'message', 'El producto pertenece a otra organización.', 'sale_id', NULL);
    END IF;
    IF v_product.active <> 1 OR v_product.deleted_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_INACTIVE',
        'message', 'El producto no está disponible.', 'sale_id', NULL);
    END IF;
    IF v_item.unit_price <> v_product.price THEN
      RETURN jsonb_build_object('success', false, 'code', 'PRICE_CHANGED',
        'message', 'El precio del producto cambió en el catálogo.', 'sale_id', NULL);
    END IF;
    v_total := v_total + (v_item.quantity * v_product.price);
  END LOOP;
  IF v_discount > v_total THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'El descuento supera el subtotal.', 'sale_id', NULL);
  END IF;
  v_payment_amount := v_total - v_discount;
  v_created_at := COALESCE(NULLIF(p_sale->>'created_at', '')::TIMESTAMPTZ, NOW());

  INSERT INTO public.sales (
    id, organization_id, owner_id, created_by, discount, total, notes,
    client_id, client_name, status, idempotency_key, payload_hash,
    server_payload_hash, created_at
  ) VALUES (
    v_sale_id, p_organization_id, v_user_id, v_user_id, v_discount, v_payment_amount,
    NULLIF(p_sale->>'notes', ''), v_client_id, NULLIF(p_sale->>'client_name', ''),
    'confirmed', p_idempotency_key, p_payload_hash, v_server_payload_hash, v_created_at
  ) ON CONFLICT (organization_id, idempotency_key)
    WHERE organization_id IS NOT NULL AND idempotency_key IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN
    SELECT id, payload_hash, server_payload_hash, status INTO v_existing
    FROM public.sales
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF v_existing.server_payload_hash IS DISTINCT FROM v_server_payload_hash THEN
      RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'message', 'La idempotency_key ya fue utilizada con otro payload.', 'sale_id', NULL);
    END IF;
    IF v_existing.status IN ('rejected', 'conflict') THEN
      RETURN jsonb_build_object('success', false, 'code', 'SALE_ALREADY_REJECTED',
        'message', 'La venta ya fue rechazada y no puede reabrirse.', 'sale_id', v_existing.id);
    END IF;
    SELECT id INTO v_payment_id FROM public.payments WHERE sale_id = v_existing.id;
    RETURN jsonb_build_object('success', true, 'idempotent', true,
      'sale_id', v_existing.id, 'payment_id', v_payment_id, 'status', v_existing.status,
      'server_payload_hash', v_server_payload_hash);
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_sale->'items') AS item(
      id TEXT, product_id TEXT, quantity INTEGER, unit_price INTEGER
    ) ORDER BY product_id
  LOOP
    SELECT stock INTO v_product FROM public.products
    WHERE id = v_item.product_id AND organization_id = p_organization_id FOR UPDATE;
    UPDATE public.products SET stock = stock - v_item.quantity, updated_at = NOW()
    WHERE id = v_item.product_id AND organization_id = p_organization_id
      AND stock >= v_item.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_INSUFFICIENT:Stock insuficiente para el producto %.', v_item.product_id;
    END IF;
    INSERT INTO public.sale_items
      (id, organization_id, sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_item.id, p_organization_id, v_sale_id, v_item.product_id,
      v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    INSERT INTO public.inventory_movements
      (id, organization_id, owner_id, product_id, type, quantity,
       reason, stock_before, stock_after, created_at)
    VALUES (gen_random_uuid()::TEXT, p_organization_id, v_user_id, v_item.product_id,
      'SALE', -v_item.quantity, 'Venta POS', v_product.stock,
      v_product.stock - v_item.quantity, NOW());
  END LOOP;

  INSERT INTO public.payments
    (id, organization_id, sale_id, method, status, amount, reference, created_at, confirmed_at)
  VALUES (v_payment_id, p_organization_id, v_sale_id, 'transfer', 'confirmed',
    v_payment_amount, NULLIF(p_sale->>'payment_reference', ''), NOW(), NOW());
  UPDATE public.sales SET confirmed_at = NOW()
  WHERE id = v_sale_id AND organization_id = p_organization_id;
  RETURN jsonb_build_object('success', true, 'idempotent', false,
    'sale_id', v_sale_id, 'payment_id', v_payment_id, 'status', 'confirmed',
    'total', v_payment_amount, 'server_payload_hash', v_server_payload_hash);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id, payload_hash, server_payload_hash, status INTO v_existing
    FROM public.sales
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF FOUND AND v_existing.server_payload_hash = v_server_payload_hash THEN
      IF v_existing.status IN ('rejected', 'conflict') THEN
        RETURN jsonb_build_object('success', false, 'code', 'SALE_ALREADY_REJECTED',
          'message', 'La venta ya fue rechazada y no puede reabrirse.', 'sale_id', v_existing.id);
      END IF;
      SELECT id INTO v_payment_id FROM public.payments WHERE sale_id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'idempotent', true,
        'sale_id', v_existing.id, 'payment_id', v_payment_id, 'status', v_existing.status,
        'server_payload_hash', v_server_payload_hash);
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'message', 'La idempotency_key ya fue utilizada con otro payload.', 'sale_id', NULL);
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_error_code := split_part(v_error, ':', 1);
    IF v_error_code = 'STOCK_INSUFFICIENT' THEN
      RETURN jsonb_build_object('success', false, 'code', 'STOCK_INSUFFICIENT',
        'message', 'El stock remoto es insuficiente.', 'sale_id', NULL);
    END IF;
    RETURN jsonb_build_object('success', false, 'code', 'INTERNAL_ERROR',
      'message', 'No fue posible procesar la venta.', 'sale_id', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.process_sale(JSONB, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_sale(JSONB, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sale_by_idempotency_key(
  p_organization_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sale RECORD;
  v_payment_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF p_organization_id IS NULL OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RETURN jsonb_build_object('found', false, 'code', 'INVALID_PAYLOAD');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = p_organization_id AND user_id = v_user_id AND active = TRUE
  ) THEN
    RETURN jsonb_build_object('found', false, 'code', 'NOT_ORGANIZATION_MEMBER');
  END IF;
  SELECT id, organization_id, status, total, server_payload_hash,
         confirmed_at, rejected_at, conflict_code, conflict_message
    INTO v_sale
  FROM public.sales
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'code', 'NOT_FOUND');
  END IF;
  SELECT id INTO v_payment_id FROM public.payments
  WHERE organization_id = p_organization_id AND sale_id = v_sale.id;
  RETURN jsonb_build_object(
    'found', true, 'sale_id', v_sale.id, 'organization_id', v_sale.organization_id,
    'status', v_sale.status, 'total', v_sale.total, 'payment_id', v_payment_id,
    'server_payload_hash', v_sale.server_payload_hash,
    'confirmed_at', v_sale.confirmed_at, 'rejected_at', v_sale.rejected_at,
    'conflict_code', v_sale.conflict_code, 'conflict_message', v_sale.conflict_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sale_by_idempotency_key(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_by_idempotency_key(UUID, TEXT) TO authenticated;
