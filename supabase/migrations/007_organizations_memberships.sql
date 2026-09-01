-- DESTELLOS DE HADA - Fase 1 / Tenancy
-- Crea el límite organizacional sin modificar todavía las tablas de negocio.

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_active
  ON public.organizations(deleted_at, updated_at);

CREATE TABLE IF NOT EXISTS public.memberships (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'seller'
                  CHECK (role IN ('owner', 'admin', 'seller')),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_active
  ON public.memberships(user_id, active);

CREATE INDEX IF NOT EXISTS idx_memberships_organization_active
  ON public.memberships(organization_id, active);
