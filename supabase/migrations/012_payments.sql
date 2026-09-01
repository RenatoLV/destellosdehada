-- FASE 3: pagos transaccionales de la Sales App.
-- Se crea antes de process_sale porque la RPC inserta el pago atomically.

CREATE TABLE IF NOT EXISTS public.payments (
  id              TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  sale_id         TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method          TEXT NOT NULL CHECK (method = 'transfer'),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'rejected')),
  amount          INTEGER NOT NULL CHECK (amount >= 0),
  reference       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  UNIQUE (sale_id),
  UNIQUE (organization_id, id)
);

CREATE INDEX IF NOT EXISTS idx_payments_organization_created
  ON public.payments(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payments_organization_status
  ON public.payments(organization_id, status, created_at);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

-- No direct INSERT/UPDATE/DELETE policy: payment mutations are performed by
-- process_sale() or a future payment-specific RPC after authorization.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM anon, authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_payment_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales AS sale
    WHERE sale.id = NEW.sale_id
      AND sale.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'ORGANIZATION_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_payment_organization() FROM PUBLIC;

DROP TRIGGER IF EXISTS payments_validate_organization ON public.payments;
CREATE TRIGGER payments_validate_organization
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_organization();
