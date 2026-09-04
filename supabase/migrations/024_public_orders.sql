-- Pedidos web: un cliente autenticado puede dejar una solicitud pendiente,
-- pero solo un miembro admin puede confirmarla y descontar stock.

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_organization_id UUID,
  p_order JSONB,
  p_idempotency_key TEXT,
  p_payload_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sale_id TEXT := NULLIF(p_order->>'id', '');
  v_existing RECORD;
  v_item RECORD;
  v_product RECORD;
  v_subtotal INTEGER := 0;
  v_discount INTEGER := COALESCE(NULLIF(p_order->>'discount', '')::INTEGER, 0);
  v_total INTEGER;
  v_payment_id TEXT := gen_random_uuid()::TEXT;
  v_customer JSONB := COALESCE(p_order->'customer', '{}'::jsonb);
  v_name TEXT := NULLIF(v_customer->>'fullName', '');
  v_contact TEXT := NULLIF(concat_ws(' | ', NULLIF(v_customer->>'email', ''), NULLIF(v_customer->>'phone', ''), NULLIF(v_customer->>'notes', '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF p_organization_id IS NULL OR v_sale_id IS NULL OR p_idempotency_key IS NULL
     OR btrim(p_idempotency_key) = '' OR p_payload_hash IS NULL
     OR jsonb_typeof(p_order->'items') <> 'array' OR jsonb_array_length(p_order->'items') = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORGANIZATION_NOT_FOUND');
  END IF;

  SELECT id, payload_hash, status, payment_id INTO v_existing
  FROM public.sales
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH');
    END IF;
    SELECT id INTO v_payment_id FROM public.payments WHERE organization_id = p_organization_id AND sale_id = v_existing.id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'sale_id', v_existing.id,
      'payment_id', v_payment_id, 'status', v_existing.status);
  END IF;

  IF v_discount < 0 THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD'); END IF;
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_order->'items') AS item(id TEXT, product_id TEXT, quantity INTEGER, unit_price INTEGER) ORDER BY product_id LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD');
    END IF;
    SELECT id, organization_id, price, active, deleted_at INTO v_product
    FROM public.products WHERE id = v_item.product_id FOR SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_NOT_FOUND'); END IF;
    IF v_product.organization_id IS DISTINCT FROM p_organization_id THEN RETURN jsonb_build_object('success', false, 'code', 'ORGANIZATION_MISMATCH'); END IF;
    IF v_product.active <> 1 OR v_product.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_INACTIVE'); END IF;
    v_subtotal := v_subtotal + (v_item.quantity * v_product.price);
  END LOOP;
  IF v_discount > v_subtotal THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD'); END IF;
  v_total := v_subtotal - v_discount;

  INSERT INTO public.sales (id, organization_id, owner_id, created_by, discount, total, notes, client_name, status, idempotency_key, payload_hash, created_at)
  VALUES (v_sale_id, p_organization_id, NULL, v_user_id, v_discount, v_total,
    COALESCE(NULLIF(p_order->>'notes', ''), v_contact), v_name, 'pending', p_idempotency_key, p_payload_hash,
    COALESCE(NULLIF(p_order->>'created_at', '')::timestamptz, NOW()));

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_order->'items') AS item(id TEXT, product_id TEXT, quantity INTEGER, unit_price INTEGER) ORDER BY product_id LOOP
    SELECT price INTO v_product FROM public.products WHERE id = v_item.product_id AND organization_id = p_organization_id;
    INSERT INTO public.sale_items (id, organization_id, sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (COALESCE(NULLIF(v_item.id, ''), gen_random_uuid()::text), p_organization_id, v_sale_id, v_item.product_id,
      v_item.quantity, v_product.price, v_item.quantity * v_product.price);
  END LOOP;
  INSERT INTO public.payments (id, organization_id, sale_id, method, status, amount, reference, created_at)
  VALUES (v_payment_id, p_organization_id, v_sale_id, 'transfer', 'pending', v_total,
    NULLIF(p_order->>'payment_reference', ''), NOW());
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'sale_id', v_sale_id,
    'payment_id', v_payment_id, 'status', 'pending', 'total', v_total);
EXCEPTION WHEN unique_violation THEN
  SELECT id, payload_hash, status INTO v_existing FROM public.sales
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND AND v_existing.payload_hash = p_payload_hash THEN
    SELECT id INTO v_payment_id FROM public.payments WHERE organization_id = p_organization_id AND sale_id = v_existing.id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'sale_id', v_existing.id, 'payment_id', v_payment_id, 'status', v_existing.status);
  END IF;
  RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_PAYLOAD_MISMATCH');
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_public_order(p_organization_id UUID, p_sale_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_sale RECORD; v_payment RECORD; v_item RECORD; v_product RECORD;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_organization_admin(p_organization_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ADMIN_REQUIRED');
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND organization_id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'SALE_NOT_FOUND'); END IF;
  IF v_sale.status = 'confirmed' THEN
    SELECT id INTO v_payment FROM public.payments WHERE sale_id = p_sale_id AND organization_id = p_organization_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'sale_id', p_sale_id, 'payment_id', v_payment.id, 'status', 'confirmed');
  END IF;
  IF v_sale.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'code', 'SALE_NOT_PENDING'); END IF;
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id AND organization_id = p_organization_id ORDER BY product_id LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id AND organization_id = p_organization_id FOR UPDATE;
    IF NOT FOUND OR v_product.active <> 1 OR v_product.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    IF v_product.price <> v_item.unit_price THEN RAISE EXCEPTION 'PRICE_CHANGED'; END IF;
    IF v_product.stock < v_item.quantity THEN RAISE EXCEPTION 'STOCK_INSUFFICIENT'; END IF;
    UPDATE public.products SET stock = stock - v_item.quantity, updated_at = NOW() WHERE id = v_item.product_id AND organization_id = p_organization_id AND stock >= v_item.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_INSUFFICIENT'; END IF;
    INSERT INTO public.inventory_movements (id, organization_id, owner_id, product_id, type, quantity, reason, stock_before, stock_after, created_at)
    VALUES (gen_random_uuid()::text, p_organization_id, v_user_id, v_item.product_id, 'SALE', -v_item.quantity, 'Pedido web aprobado', v_product.stock, v_product.stock - v_item.quantity, NOW());
  END LOOP;
  UPDATE public.payments SET status = 'confirmed', confirmed_at = NOW() WHERE sale_id = p_sale_id AND organization_id = p_organization_id AND method = 'transfer';
  UPDATE public.sales SET status = 'confirmed', confirmed_at = NOW() WHERE id = p_sale_id AND organization_id = p_organization_id;
  SELECT id INTO v_payment FROM public.payments WHERE sale_id = p_sale_id AND organization_id = p_organization_id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'sale_id', p_sale_id, 'payment_id', v_payment.id, 'status', 'confirmed');
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'PRICE_CHANGED' THEN RETURN jsonb_build_object('success', false, 'code', 'PRICE_CHANGED'); END IF;
  IF SQLERRM = 'STOCK_INSUFFICIENT' THEN RETURN jsonb_build_object('success', false, 'code', 'STOCK_INSUFFICIENT'); END IF;
  IF SQLERRM = 'PRODUCT_UNAVAILABLE' THEN RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_UNAVAILABLE'); END IF;
  RETURN jsonb_build_object('success', false, 'code', 'INTERNAL_ERROR');
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_public_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_order(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_public_order(UUID, TEXT) TO authenticated;
