-- DESTELLOS DE HADA - Fase 1 / Backfill seguro
-- No asigna registros a propietarios desconocidos. Los casos ambiguos quedan
-- en private.tenancy_backfill_pending para resolución explícita.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.tenancy_backfill_pending (
  table_name       TEXT NOT NULL,
  record_id        TEXT NOT NULL,
  owner_id         UUID,
  organization_id  UUID,
  reason           TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_name, record_id)
);

CREATE TEMP TABLE _tenancy_owner_candidates (
  user_id UUID PRIMARY KEY
) ON COMMIT DROP;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'products', 'product_images', 'clients',
    'sales', 'inventory_movements'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND information_schema.columns.table_name = table_name
        AND column_name = 'owner_id'
    ) THEN
      EXECUTE format(
        'INSERT INTO _tenancy_owner_candidates(user_id)
         SELECT DISTINCT owner_id
         FROM public.%I
         WHERE owner_id IS NOT NULL
         ON CONFLICT (user_id) DO NOTHING',
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- Si hay un único propietario explícito y todavía no existe una organización,
-- la organización inicial es una inferencia determinista y auditable.
-- Con varios propietarios no se crea ninguna organización arbitrariamente.
DO $$
DECLARE
  owner_count INTEGER;
  organization_count INTEGER;
  known_user UUID;
  known_organization UUID;
BEGIN
  SELECT COUNT(*) INTO owner_count FROM _tenancy_owner_candidates;
  SELECT COUNT(*) INTO organization_count
  FROM public.organizations
  WHERE deleted_at IS NULL;

  IF owner_count = 1 THEN
    SELECT user_id INTO known_user FROM _tenancy_owner_candidates LIMIT 1;

    IF organization_count = 0 THEN
      INSERT INTO public.organizations (name)
      VALUES ('Organización migrada - pendiente de confirmación')
      RETURNING id INTO known_organization;

      INSERT INTO public.memberships (organization_id, user_id, role, active)
      VALUES (known_organization, known_user, 'owner', TRUE)
      ON CONFLICT (organization_id, user_id) DO UPDATE
        SET active = TRUE, role = 'owner', updated_at = NOW();
    ELSIF organization_count = 1 THEN
      SELECT id INTO known_organization
      FROM public.organizations
      WHERE deleted_at IS NULL
      ORDER BY created_at, id
      LIMIT 1;

      INSERT INTO public.memberships (organization_id, user_id, role, active)
      VALUES (known_organization, known_user, 'owner', TRUE)
      ON CONFLICT (organization_id, user_id) DO UPDATE
        SET active = TRUE, role = 'owner', updated_at = NOW();
    END IF;
  END IF;
END $$;

-- Solo se asocia automáticamente un registro cuyo owner_id tiene exactamente
-- una membership activa. Esto evita elegir arbitrariamente entre tiendas.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'products', 'product_images', 'clients',
    'sales', 'inventory_movements'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I AS entity
       SET organization_id = membership.organization_id
       FROM public.memberships AS membership
       WHERE entity.organization_id IS NULL
         AND entity.owner_id = membership.user_id
         AND membership.active = TRUE
         AND (
           SELECT COUNT(DISTINCT membership_other.organization_id)
           FROM public.memberships AS membership_other
           WHERE membership_other.user_id = entity.owner_id
             AND membership_other.active = TRUE
         ) = 1',
      table_name
    );
  END LOOP;
END $$;

-- sale_items no tiene owner_id: su organización se deriva de su venta.
UPDATE public.sale_items AS item
SET organization_id = sale.organization_id
FROM public.sales AS sale
WHERE item.organization_id IS NULL
  AND item.sale_id = sale.id
  AND sale.organization_id IS NOT NULL;

-- cat_general es una fila de sistema creada por 001, no un registro cuyo
-- propietario deba inventarse. Solo se asocia cuando existe una única
-- organización activa, por lo que no introduce una elección ambigua.
UPDATE public.categories AS category
SET organization_id = organization.id
FROM public.organizations AS organization
WHERE category.id = 'cat_general'
  AND category.organization_id IS NULL
  AND organization.deleted_at IS NULL
  AND (
    SELECT COUNT(*) FROM public.organizations AS active_organization
    WHERE active_organization.deleted_at IS NULL
  ) = 1;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories', 'products', 'product_images', 'clients',
    'sales', 'inventory_movements'
  ] LOOP
    EXECUTE format(
      'INSERT INTO private.tenancy_backfill_pending
         (table_name, record_id, owner_id, organization_id, reason)
       SELECT %L, entity.id::TEXT, entity.owner_id, entity.organization_id,
              CASE
                WHEN entity.owner_id IS NULL THEN ''ownership_not_available''
                ELSE ''organization_mapping_ambiguous_or_missing''
              END
       FROM public.%I AS entity
       WHERE entity.organization_id IS NULL
       ON CONFLICT (table_name, record_id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         organization_id = EXCLUDED.organization_id,
         reason = EXCLUDED.reason,
         updated_at = NOW() ',
      table_name, table_name
    );
  END LOOP;
END $$;

INSERT INTO private.tenancy_backfill_pending
  (table_name, record_id, organization_id, reason)
SELECT 'sale_items', item.id::TEXT, item.organization_id,
       'sale_item_without_resolved_sale_organization'
FROM public.sale_items AS item
WHERE item.organization_id IS NULL
ON CONFLICT (table_name, record_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  reason = EXCLUDED.reason,
  updated_at = NOW();
