-- Fix the shared tenancy trigger used by entity tables with different shapes.
--
-- The v010 implementation referenced NEW.sale_id inside a conditional that is
-- evaluated for every trigger target. PostgreSQL validates that field before it
-- evaluates TG_TABLE_NAME, so inserts into products, categories and clients
-- failed because those rows do not have a sale_id column.
CREATE OR REPLACE FUNCTION public.populate_organization_id_from_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resolved_organization UUID;
  organization_count INTEGER;
  resolved_owner UUID;
BEGIN
  -- sale_items has no owner_id. Resolve its tenant only from its parent sale
  -- before reading any fields that only exist on that table.
  IF TG_TABLE_NAME = 'sale_items' THEN
    IF NEW.organization_id IS NULL AND NEW.sale_id IS NOT NULL THEN
      SELECT organization_id INTO NEW.organization_id
      FROM public.sales
      WHERE id = NEW.sale_id;
    END IF;

    RETURN NEW;
  END IF;

  -- Other trigger targets may retain owner_id for legacy compatibility. The
  -- trigger fills organization_id only when that user has exactly one active
  -- membership, never guessing a tenant for a multi-organization user.
  resolved_owner := NULLIF(to_jsonb(NEW)->>'owner_id', '')::UUID;

  IF NEW.organization_id IS NULL AND resolved_owner IS NOT NULL THEN
    SELECT COUNT(DISTINCT organization_id), MIN(organization_id)
      INTO organization_count, resolved_organization
    FROM public.memberships
    WHERE user_id = resolved_owner
      AND active = TRUE;

    IF organization_count = 1 THEN
      NEW.organization_id := resolved_organization;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_organization_id_from_context() FROM PUBLIC;
