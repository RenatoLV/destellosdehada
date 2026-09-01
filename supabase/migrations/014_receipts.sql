-- FASE 5: comprobantes de transferencias.
-- El bucket es privado y la fila de receipts es la asociación autorizada.

CREATE TABLE IF NOT EXISTS public.receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  sale_id         TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_id      TEXT NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  storage_path    TEXT NOT NULL,
  mime_type       TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size       BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  checksum        TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at     TIMESTAMPTZ,
  UNIQUE (storage_path),
  UNIQUE (payment_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_organization_sale
  ON public.receipts(organization_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_receipts_organization_status
  ON public.receipts(organization_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_receipts_payment
  ON public.receipts(organization_id, payment_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_select ON public.receipts;
CREATE POLICY receipts_select ON public.receipts
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

-- Receipt writes are performed by attach_receipt() after Storage upload.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.receipts FROM anon, authenticated;
GRANT SELECT ON TABLE public.receipts TO authenticated;

-- Explicitly keep this bucket private. The ON CONFLICT branch also repairs a
-- previously-created bucket without exposing existing objects publicly.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sale-receipts', 'sale-receipts', FALSE, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS sale_receipts_select ON storage.objects;
CREATE POLICY sale_receipts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sale-receipts'
    AND EXISTS (
      SELECT 1
      FROM public.receipts AS receipt
      WHERE receipt.storage_path = storage.objects.name
        AND public.is_organization_member(receipt.organization_id)
    )
  );

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
      FROM public.organizations AS organization
      WHERE organization.id::text = (storage.foldername(name))[1]
        AND public.is_organization_member(organization.id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.sales AS sale
      WHERE sale.id = (storage.foldername(name))[2]
        AND sale.organization_id::text = (storage.foldername(name))[1]
        AND sale.status = 'confirmed'
    )
  );

-- No UPDATE or DELETE policy is granted to clients. Orphan cleanup, if ever
-- needed, belongs to a privileged server-side maintenance operation.
