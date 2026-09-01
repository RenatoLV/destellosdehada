-- FASE 5: asociación transaccional e idempotente del objeto privado con una venta.

CREATE OR REPLACE FUNCTION public.attach_receipt(
  p_organization_id UUID,
  p_sale_id        TEXT,
  p_payment_id     TEXT,
  p_receipt_id     UUID,
  p_storage_path   TEXT,
  p_mime_type      TEXT,
  p_file_size      BIGINT,
  p_checksum       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sale RECORD;
  v_payment RECORD;
  v_existing RECORD;
  v_expected_path TEXT;
  v_extension TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'message', 'La sesión autenticada es obligatoria.', 'receipt_id', NULL);
  END IF;

  IF p_organization_id IS NULL OR p_sale_id IS NULL OR p_payment_id IS NULL
     OR p_receipt_id IS NULL OR p_storage_path IS NULL OR p_mime_type IS NULL
     OR p_file_size IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD',
      'message', 'Faltan datos obligatorios del comprobante.', 'receipt_id', NULL);
  END IF;

  IF NOT public.is_organization_member(p_organization_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ORGANIZATION_MEMBER',
      'message', 'El usuario no pertenece activamente a la organización.', 'receipt_id', NULL);
  END IF;

  SELECT id, organization_id, status
    INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'SALE_NOT_FOUND',
      'message', 'La venta no existe.', 'receipt_id', NULL);
  END IF;
  IF v_sale.organization_id IS DISTINCT FROM p_organization_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORGANIZATION_MISMATCH',
      'message', 'La venta pertenece a otra organización.', 'receipt_id', NULL);
  END IF;
  IF v_sale.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'SALE_NOT_CONFIRMED',
      'message', 'La venta aún no está confirmada.', 'receipt_id', NULL);
  END IF;

  SELECT id, organization_id, sale_id, method, status
    INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND',
      'message', 'El pago no existe.', 'receipt_id', NULL);
  END IF;
  IF v_payment.organization_id IS DISTINCT FROM p_organization_id
     THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_ORGANIZATION_MISMATCH',
      'message', 'El pago pertenece a otra organización.', 'receipt_id', NULL);
  END IF;
  IF v_payment.sale_id IS DISTINCT FROM p_sale_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_SALE_MISMATCH',
      'message', 'El pago pertenece a otra venta.', 'receipt_id', NULL);
  END IF;
  IF v_payment.method <> 'transfer' OR v_payment.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_CONFIRMED',
      'message', 'El pago no está confirmado como transferencia.', 'receipt_id', NULL);
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     OR p_file_size <= 0 OR p_file_size > 10485760 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_RECEIPT',
      'message', 'El tipo o tamaño del comprobante no es válido.', 'receipt_id', NULL);
  END IF;

  v_extension := CASE p_mime_type
    WHEN 'image/jpeg' THEN 'jpg'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/webp' THEN 'webp'
    WHEN 'application/pdf' THEN 'pdf'
  END;
  v_expected_path := p_organization_id::TEXT || '/' || p_sale_id || '/' ||
    p_receipt_id::TEXT || '.' || v_extension;

  IF p_storage_path <> v_expected_path THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STORAGE_PATH',
      'message', 'La ruta del comprobante no corresponde a su organización y venta.', 'receipt_id', NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'sale-receipts' AND name = p_storage_path
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_NOT_UPLOADED',
      'message', 'El archivo no existe en el Storage privado.', 'receipt_id', NULL);
  END IF;

  SELECT * INTO v_existing
  FROM public.receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.organization_id IS DISTINCT FROM p_organization_id THEN
      RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_ORGANIZATION_MISMATCH',
        'message', 'El comprobante pertenece a otra organización.', 'receipt_id', NULL);
    END IF;
    IF v_existing.sale_id IS DISTINCT FROM p_sale_id
       OR v_existing.payment_id IS DISTINCT FROM p_payment_id
       OR v_existing.storage_path IS DISTINCT FROM p_storage_path
       OR v_existing.mime_type IS DISTINCT FROM p_mime_type
       OR v_existing.file_size IS DISTINCT FROM p_file_size
       OR v_existing.checksum IS DISTINCT FROM p_checksum THEN
      RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_PAYLOAD_MISMATCH',
        'message', 'El comprobante ya existe con otro payload.', 'receipt_id', NULL);
    END IF;
    UPDATE public.receipts
    SET status = 'uploaded', uploaded_at = COALESCE(uploaded_at, v_now), updated_at = v_now
    WHERE id = p_receipt_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true,
      'receipt_id', p_receipt_id, 'sale_id', p_sale_id, 'payment_id', p_payment_id,
      'status', 'uploaded');
  END IF;

  IF EXISTS (SELECT 1 FROM public.receipts WHERE payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_ALREADY_ATTACHED',
      'message', 'El pago ya tiene un comprobante asociado.', 'receipt_id', NULL);
  END IF;

  INSERT INTO public.receipts (
    id, organization_id, sale_id, payment_id, storage_path, mime_type,
    file_size, checksum, created_by, status, created_at, updated_at, uploaded_at
  ) VALUES (
    p_receipt_id, p_organization_id, p_sale_id, p_payment_id, p_storage_path,
    p_mime_type, p_file_size, p_checksum, v_user_id, 'uploaded', v_now, v_now, v_now
  );

  RETURN jsonb_build_object('success', true, 'idempotent', false,
    'receipt_id', p_receipt_id, 'sale_id', p_sale_id, 'payment_id', p_payment_id,
    'status', 'uploaded');
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_ALREADY_ATTACHED',
      'message', 'El comprobante ya fue asociado.', 'receipt_id', NULL);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'INTERNAL_ERROR',
      'message', 'No fue posible asociar el comprobante.', 'receipt_id', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_receipt(UUID, TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_receipt(UUID, TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.attach_receipt(UUID, TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT) TO authenticated;
