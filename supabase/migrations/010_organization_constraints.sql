-- DESTELLOS DE HADA - Fase 1 / Constraints, índices y puente de compatibilidad

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.tenancy_constraint_violations (
  constraint_name TEXT NOT NULL,
  table_name      TEXT NOT NULL,
  record_key      TEXT NOT NULL,
  details         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (constraint_name, table_name, record_key)
);

DO $$
DECLARE
  table_name TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'products', 'product_images', 'clients',
    'sales', 'sale_items', 'inventory_movements'
  ] LOOP
    constraint_name := table_name || '_organization_id_fkey';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I
         ADD CONSTRAINT %I FOREIGN KEY (organization_id)
         REFERENCES public.organizations(id) ON DELETE RESTRICT',
        table_name, constraint_name
      );
    END IF;
  END LOOP;
END $$;

-- Índices de acceso organizacional.
CREATE INDEX IF NOT EXISTS idx_categories_organization_updated
  ON public.categories(organization_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_products_organization_active_updated
  ON public.products(organization_id, active, updated_at);
CREATE INDEX IF NOT EXISTS idx_product_images_organization_product
  ON public.product_images(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization_updated
  ON public.clients(organization_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_organization_created
  ON public.sales(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_organization_sale
  ON public.sale_items(organization_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_organization_created
  ON public.inventory_movements(organization_id, created_at);

-- Estas claves permiten agregar FKs compuestas de organización más adelante
-- sin cambiar los IDs históricos TEXT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_organization_id
  ON public.categories(organization_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_organization_id
  ON public.products(organization_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_organization_id
  ON public.clients(organization_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_organization_id
  ON public.sales(organization_id, id);

-- Unicidad de negocio solo se activa si los datos actuales no la contradicen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.categories
    WHERE organization_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY organization_id, LOWER(name)
    HAVING COUNT(*) > 1
  ) THEN
    INSERT INTO private.tenancy_constraint_violations
      (constraint_name, table_name, record_key, details)
    SELECT 'categories_organization_name_unique', 'categories',
           organization_id::TEXT || ':' || LOWER(name),
           jsonb_build_object('organization_id', organization_id, 'name', name, 'count', COUNT(*))
    FROM public.categories
    WHERE organization_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY organization_id, LOWER(name), name
    HAVING COUNT(*) > 1
    ON CONFLICT DO NOTHING;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_organization_name
      ON public.categories(organization_id, LOWER(name))
      WHERE deleted_at IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE organization_id IS NOT NULL AND sku IS NOT NULL AND deleted_at IS NULL
    GROUP BY organization_id, sku
    HAVING COUNT(*) > 1
  ) THEN
    INSERT INTO private.tenancy_constraint_violations
      (constraint_name, table_name, record_key, details)
    SELECT 'products_organization_sku_unique', 'products',
           organization_id::TEXT || ':' || sku,
           jsonb_build_object('organization_id', organization_id, 'sku', sku, 'count', COUNT(*))
    FROM public.products
    WHERE organization_id IS NOT NULL AND sku IS NOT NULL AND deleted_at IS NULL
    GROUP BY organization_id, sku
    HAVING COUNT(*) > 1
    ON CONFLICT DO NOTHING;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_products_organization_sku
      ON public.products(organization_id, sku)
      WHERE sku IS NOT NULL AND deleted_at IS NULL;
  END IF;
END $$;

-- El trigger mantiene compatible la RPC process_sale() de 006: esa función
-- todavía escribe owner_id y no organization_id. La organización se deriva
-- únicamente cuando existe una membership activa y no ambigua.
CREATE OR REPLACE FUNCTION public.populate_organization_id_from_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_organization UUID;
  organization_count INTEGER;
  resolved_owner UUID;
BEGIN
  -- to_jsonb(NEW) permite que el mismo trigger se use en sale_items, que no
  -- tiene owner_id y deriva la organización desde su venta.
  resolved_owner := NULLIF(to_jsonb(NEW)->>'owner_id', '')::UUID;

  IF NEW.organization_id IS NULL AND resolved_owner IS NOT NULL THEN
    SELECT COUNT(DISTINCT organization_id), MIN(organization_id)
      INTO organization_count, resolved_organization
    FROM public.memberships
    WHERE user_id = resolved_owner AND active = TRUE;

    IF organization_count = 1 THEN
      NEW.organization_id := resolved_organization;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'sale_items' AND NEW.organization_id IS NULL AND NEW.sale_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.sales
    WHERE id = NEW.sale_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_organization_id_from_context() FROM PUBLIC;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'products', 'product_images', 'clients',
    'sales', 'sale_items', 'inventory_movements'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = table_name || '_populate_organization_id'
        AND tgrelid = ('public.' || table_name)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I
         BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.populate_organization_id_from_context()',
        table_name || '_populate_organization_id', table_name
      );
    END IF;
  END LOOP;
END $$;

-- No se fuerza NOT NULL cuando quedan registros pendientes. Así la migración
-- no destruye datos ni falla silenciosamente; esos casos están auditados en
-- private.tenancy_backfill_pending.
DO $$
DECLARE
  entity_table_name TEXT;
BEGIN
  FOREACH entity_table_name IN ARRAY ARRAY[
    'categories', 'products', 'product_images', 'clients',
    'sales', 'sale_items', 'inventory_movements'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' AND tablename = entity_table_name
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM private.tenancy_backfill_pending AS pending
      WHERE pending.table_name = entity_table_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',
        entity_table_name
      );
    END IF;
  END LOOP;
END $$;

-- idempotency_key no existe en el schema actual. Su UNIQUE organizacional se
-- reserva para una migración posterior que también actualizará process_sale().
