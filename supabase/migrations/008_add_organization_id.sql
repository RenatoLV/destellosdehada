-- DESTELLOS DE HADA - Fase 1 / Columnas de tenancy
-- Las columnas comienzan nullable para permitir un backfill seguro en 009.
-- owner_id se conserva como puente de compatibilidad con 006.

ALTER TABLE IF EXISTS public.categories
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS public.product_images
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS public.sales
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS public.sale_items
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS public.inventory_movements
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 006 no necesariamente fue aplicada en el proyecto remoto. Se asegura la
-- columna de compatibilidad solamente si no existe; no se elimina ni renombra.
ALTER TABLE IF EXISTS public.categories
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS public.product_images
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS public.sales
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS public.inventory_movements
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
