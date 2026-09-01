-- FASE 6: reserva server-side de receipts antes del upload a Storage.

CREATE OR REPLACE FUNCTION public.reserve_receipt(
  p_organization_id UUID,
  p_sale_id        TEXT,
  p_payment_id     TEXT,
  p_receipt_id     UUID,
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
  v_extension TEXT;
  v_storage_path TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'receipt_id', NULL);
  END IF;
  IF p_organization_id IS NULL OR p_sale_id IS NULL OR p_payment_id IS NULL
     OR p_receipt_id IS NULL OR p_mime_type IS NULL OR p_file_size IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD', 'receipt_id', NULL);
  END IF;
  IF NOT public.is_organization_member(p_organization_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ORGANIZATION_MEMBER', 'receipt_id', NULL);
  END IF;

  SELECT id, organization_id, status INTO v_sale
  FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'SALE_NOT_FOUND', 'receipt_id', NULL);
  END IF;
  IF v_sale.organization_id IS DISTINCT FROM p_organization_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORGANIZATION_MISMATCH', 'receipt_id', NULL);
  END IF;
  IF v_sale.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'SALE_NOT_CONFIRMED', 'receipt_id', NULL);
  END IF;

  SELECT id, organization_id, sale_id, method, status INTO v_payment
  FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND', 'receipt_id', NULL);
  END IF;
  IF v_payment.organization_id IS DISTINCT FROM p_organization_id
     OR v_payment.sale_id IS DISTINCT FROM p_sale_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_SALE_MISMATCH', 'receipt_id', NULL);
  END IF;
  IF v_payment.method <> 'transfer' OR v_payment.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_CONFIRMED', 'receipt_id', NULL);
  END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     OR p_file_size <= 0 OR p_file_size > 10485760 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_RECEIPT', 'receipt_id', NULL);
  END IF;

  v_extension := CASE p_mime_type
    WHEN 'image/jpeg' THEN 'jpg'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/webp' THEN 'webp'
    WHEN 'application/pdf' THEN 'pdf'
  END;
  v_storage_path := p_organization_id::TEXT || '/' || p_sale_id || '/' ||
    p_receipt_id::TEXT || '.' || v_extension;

  SELECT * INTO v_existing FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.organization_id IS DISTINCT FROM p_organization_id
       OR v_existing.sale_id IS DISTINCT FROM p_sale_id
       OR v_existing.payment_id IS DISTINCT FROM p_payment_id
       OR v_existing.storage_path IS DISTINCT FROM v_storage_path
       OR v_existing.mime_type IS DISTINCT FROM p_mime_type
       OR v_existing.file_size IS DISTINCT FROM p_file_size
       OR v_existing.checksum IS DISTINCT FROM p_checksum THEN
      RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_PAYLOAD_MISMATCH', 'receipt_id', NULL);
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true,
      'receipt_id', p_receipt_id, 'storage_path', v_storage_path, 'status', v_existing.status);
  END IF;

  IF EXISTS (SELECT 1 FROM public.receipts WHERE payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_ALREADY_ATTACHED', 'receipt_id', NULL);
  END IF;

  INSERT INTO public.receipts (
    id, organization_id, sale_id, payment_id, storage_path, mime_type,
    file_size, checksum, created_by, status, created_at, updated_at
  ) VALUES (
    p_receipt_id, p_organization_id, p_sale_id, p_payment_id, v_storage_path,
    p_mime_type, p_file_size, p_checksum, v_user_id, 'pending', v_now, v_now
  );
  RETURN jsonb_build_object('success', true, 'idempotent', false,
    'receipt_id', p_receipt_id, 'storage_path', v_storage_path, 'status', 'pending');
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'RECEIPT_ALREADY_ATTACHED', 'receipt_id', NULL);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', 'INTERNAL_ERROR', 'receipt_id', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_receipt(UUID, TEXT, TEXT, UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_receipt(UUID, TEXT, TEXT, UUID, TEXT, BIGINT, TEXT) TO authenticated;

-- An object can only be uploaded after a matching receipt reservation exists.
DROP POLICY IF EXISTS sale_receipts_insert ON storage.objects;
CREATE POLICY sale_receipts_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sale-receipts'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (storage.foldername(name))[2] <> ''
    AND storage.filename(name) ~ '^[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$'
    AND EXISTS (
      SELECT 1
      FROM public.receipts AS receipt
      JOIN public.sales AS sale ON sale.id = receipt.sale_id
        AND sale.organization_id = receipt.organization_id
      WHERE receipt.storage_path = storage.objects.name
        AND receipt.organization_id::TEXT = (storage.foldername(name))[1]
        AND sale.status = 'confirmed'
        AND receipt.status IN ('pending', 'uploading')
        AND public.is_organization_member(receipt.organization_id)
    )
  );
