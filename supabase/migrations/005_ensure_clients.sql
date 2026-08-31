-- Asegura que el proyecto remoto tenga la tabla de clientes.
-- Es idempotente para instalaciones que ya ejecutaron 001_initial_schema.
CREATE TABLE IF NOT EXISTS public.clients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  rut         TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'auth_select_clients') THEN
    CREATE POLICY "auth_select_clients" ON public.clients FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'auth_insert_clients') THEN
    CREATE POLICY "auth_insert_clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'auth_update_clients') THEN
    CREATE POLICY "auth_update_clients" ON public.clients FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
