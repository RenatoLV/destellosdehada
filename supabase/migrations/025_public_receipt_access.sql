-- El comprador autenticado puede reservar/subir/asociar el comprobante de su
-- propio pedido pendiente. Los miembros de la organización conservan acceso
-- para ventas confirmadas y revisión administrativa.

CREATE OR REPLACE FUNCTION public.reserve_receipt(
  p_organization_id UUID, p_sale_id TEXT, p_payment_id TEXT, p_receipt_id UUID,
  p_mime_type TEXT, p_file_size BIGINT, p_checksum TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID := auth.uid(); v_sale RECORD; v_payment RECORD; v_existing RECORD;
  v_extension TEXT; v_storage_path TEXT; v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success',false,'code','UNAUTHENTICATED'); END IF;
  IF p_organization_id IS NULL OR p_sale_id IS NULL OR p_payment_id IS NULL OR p_receipt_id IS NULL
     OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp','application/pdf')
     OR p_file_size IS NULL OR p_file_size <= 0 OR p_file_size > 10485760 THEN
    RETURN jsonb_build_object('success',false,'code','INVALID_RECEIPT');
  END IF;
  SELECT id, organization_id, status, created_by INTO v_sale FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND OR v_sale.organization_id IS DISTINCT FROM p_organization_id THEN
    RETURN jsonb_build_object('success',false,'code','SALE_NOT_FOUND');
  END IF;
  IF NOT public.is_organization_member(p_organization_id)
     AND (v_sale.created_by IS DISTINCT FROM v_user_id OR v_sale.status <> 'pending') THEN
    RETURN jsonb_build_object('success',false,'code','NOT_ORGANIZATION_MEMBER');
  END IF;
  IF v_sale.status NOT IN ('pending','confirmed') THEN RETURN jsonb_build_object('success',false,'code','SALE_NOT_CONFIRMED'); END IF;
  SELECT id, organization_id, sale_id, method, status INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.organization_id IS DISTINCT FROM p_organization_id OR v_payment.sale_id IS DISTINCT FROM p_sale_id
     OR v_payment.method <> 'transfer' OR (v_sale.status='confirmed' AND v_payment.status <> 'confirmed') THEN
    RETURN jsonb_build_object('success',false,'code','PAYMENT_NOT_CONFIRMED');
  END IF;
  v_extension := CASE p_mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' ELSE 'pdf' END;
  v_storage_path := p_organization_id::text || '/' || p_sale_id || '/' || p_receipt_id::text || '.' || v_extension;
  SELECT * INTO v_existing FROM public.receipts WHERE id=p_receipt_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.organization_id IS DISTINCT FROM p_organization_id OR v_existing.sale_id IS DISTINCT FROM p_sale_id
       OR v_existing.payment_id IS DISTINCT FROM p_payment_id OR v_existing.storage_path IS DISTINCT FROM v_storage_path
       OR v_existing.mime_type IS DISTINCT FROM p_mime_type OR v_existing.file_size IS DISTINCT FROM p_file_size
       OR v_existing.checksum IS DISTINCT FROM p_checksum THEN
      RETURN jsonb_build_object('success',false,'code','RECEIPT_PAYLOAD_MISMATCH');
    END IF;
    RETURN jsonb_build_object('success',true,'idempotent',true,'receipt_id',p_receipt_id,'storage_path',v_storage_path,'status',v_existing.status);
  END IF;
  IF EXISTS (SELECT 1 FROM public.receipts WHERE payment_id=p_payment_id) THEN RETURN jsonb_build_object('success',false,'code','RECEIPT_ALREADY_ATTACHED'); END IF;
  INSERT INTO public.receipts (id,organization_id,sale_id,payment_id,storage_path,mime_type,file_size,checksum,created_by,status,created_at,updated_at)
  VALUES (p_receipt_id,p_organization_id,p_sale_id,p_payment_id,v_storage_path,p_mime_type,p_file_size,p_checksum,v_user_id,'pending',v_now,v_now);
  RETURN jsonb_build_object('success',true,'idempotent',false,'receipt_id',p_receipt_id,'storage_path',v_storage_path,'status','pending');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('success',false,'code','RECEIPT_ALREADY_ATTACHED');
WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code','INTERNAL_ERROR'); END; $$;

DROP POLICY IF EXISTS sale_receipts_insert ON storage.objects;
CREATE POLICY sale_receipts_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='sale-receipts'
  AND array_length(storage.foldername(name),1)=2
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (storage.foldername(name))[2] <> ''
  AND storage.filename(name) ~ '^[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp|pdf)$'
  AND EXISTS (
    SELECT 1 FROM public.receipts r JOIN public.sales s ON s.id=r.sale_id AND s.organization_id=r.organization_id
    WHERE r.storage_path=name AND r.organization_id::text=(storage.foldername(name))[1]
      AND r.status IN ('pending','uploading')
      AND ((s.status='confirmed' AND public.is_organization_member(r.organization_id))
        OR (s.status='pending' AND s.created_by=auth.uid()))
  )
);

CREATE OR REPLACE FUNCTION public.attach_receipt(
  p_organization_id UUID, p_sale_id TEXT, p_payment_id TEXT, p_receipt_id UUID,
  p_storage_path TEXT, p_mime_type TEXT, p_file_size BIGINT, p_checksum TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID := auth.uid(); v_sale RECORD; v_payment RECORD; v_existing RECORD;
  v_expected_path TEXT; v_extension TEXT; v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success',false,'code','UNAUTHENTICATED'); END IF;
  SELECT id,organization_id,status,created_by INTO v_sale FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND OR v_sale.organization_id IS DISTINCT FROM p_organization_id THEN RETURN jsonb_build_object('success',false,'code','SALE_NOT_FOUND'); END IF;
  IF NOT public.is_organization_member(p_organization_id)
     AND (v_sale.created_by IS DISTINCT FROM v_user_id OR v_sale.status <> 'pending') THEN RETURN jsonb_build_object('success',false,'code','NOT_ORGANIZATION_MEMBER'); END IF;
  SELECT id,organization_id,sale_id,method,status INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.organization_id IS DISTINCT FROM p_organization_id OR v_payment.sale_id IS DISTINCT FROM p_sale_id
     OR v_payment.method <> 'transfer' OR (v_sale.status='confirmed' AND v_payment.status <> 'confirmed') THEN RETURN jsonb_build_object('success',false,'code','PAYMENT_NOT_CONFIRMED'); END IF;
  v_extension := CASE p_mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'application/pdf' THEN 'pdf' ELSE NULL END;
  IF v_extension IS NULL OR p_file_size IS NULL OR p_file_size <= 0 OR p_file_size > 10485760 THEN RETURN jsonb_build_object('success',false,'code','INVALID_RECEIPT'); END IF;
  v_expected_path := p_organization_id::text || '/' || p_sale_id || '/' || p_receipt_id::text || '.' || v_extension;
  IF p_storage_path IS DISTINCT FROM v_expected_path THEN RETURN jsonb_build_object('success',false,'code','INVALID_STORAGE_PATH'); END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='sale-receipts' AND name=p_storage_path) THEN RETURN jsonb_build_object('success',false,'code','RECEIPT_NOT_UPLOADED'); END IF;
  SELECT * INTO v_existing FROM public.receipts WHERE id=p_receipt_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.organization_id IS DISTINCT FROM p_organization_id OR v_existing.sale_id IS DISTINCT FROM p_sale_id OR v_existing.payment_id IS DISTINCT FROM p_payment_id
       OR v_existing.storage_path IS DISTINCT FROM p_storage_path OR v_existing.mime_type IS DISTINCT FROM p_mime_type OR v_existing.file_size IS DISTINCT FROM p_file_size OR v_existing.checksum IS DISTINCT FROM p_checksum
    THEN RETURN jsonb_build_object('success',false,'code','RECEIPT_PAYLOAD_MISMATCH'); END IF;
    UPDATE public.receipts SET status='uploaded',uploaded_at=COALESCE(uploaded_at,v_now),updated_at=v_now WHERE id=p_receipt_id;
    RETURN jsonb_build_object('success',true,'idempotent',true,'receipt_id',p_receipt_id,'status','uploaded');
  END IF;
  IF EXISTS (SELECT 1 FROM public.receipts WHERE payment_id=p_payment_id) THEN RETURN jsonb_build_object('success',false,'code','RECEIPT_ALREADY_ATTACHED'); END IF;
  INSERT INTO public.receipts (id,organization_id,sale_id,payment_id,storage_path,mime_type,file_size,checksum,created_by,status,created_at,updated_at,uploaded_at)
  VALUES (p_receipt_id,p_organization_id,p_sale_id,p_payment_id,p_storage_path,p_mime_type,p_file_size,p_checksum,v_user_id,'uploaded',v_now,v_now,v_now);
  RETURN jsonb_build_object('success',true,'idempotent',false,'receipt_id',p_receipt_id,'status','uploaded');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('success',false,'code','RECEIPT_ALREADY_ATTACHED');
WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code','INTERNAL_ERROR'); END; $$;

REVOKE ALL ON FUNCTION public.reserve_receipt(UUID,TEXT,TEXT,UUID,TEXT,BIGINT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attach_receipt(UUID,TEXT,TEXT,UUID,TEXT,TEXT,BIGINT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_receipt(UUID,TEXT,TEXT,UUID,TEXT,BIGINT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_receipt(UUID,TEXT,TEXT,UUID,TEXT,TEXT,BIGINT,TEXT) TO authenticated;
