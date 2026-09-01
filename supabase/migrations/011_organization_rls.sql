-- DESTELLOS DE HADA - Fase 1 / RLS organizacional
-- Reemplaza policies anteriores, incluyendo las políticas abiertas de 001.

CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.organization_id = target_organization
      AND membership.user_id = auth.uid()
      AND membership.active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_admin(target_organization UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.organization_id = target_organization
      AND membership.user_id = auth.uid()
      AND membership.active = TRUE
      AND membership.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_organization_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_organization_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_admin(UUID) TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Se eliminan todas las policies conocidas de estas tablas, no solamente las
-- names del repositorio. Con RLS las policies permissive se combinan con OR;
-- dejar una policy antigua podría reabrir el acceso.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'organizations', 'memberships', 'categories', 'products',
        'product_images', 'clients', 'sales', 'sale_items',
        'inventory_movements'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

CREATE POLICY organization_select ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_organization_member(id));

CREATE POLICY organization_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_organization_admin(id))
  WITH CHECK (public.is_organization_admin(id));

CREATE POLICY membership_select ON public.memberships
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE POLICY membership_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY membership_update ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY membership_delete ON public.memberships
  FOR DELETE TO authenticated
  USING (public.is_organization_admin(organization_id));

CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE POLICY categories_admin_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY categories_admin_update ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(organization_id)
    AND active = 1
    AND deleted_at IS NULL
  );

CREATE POLICY products_admin_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY products_admin_update ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY product_images_select ON public.product_images
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE POLICY product_images_admin_insert ON public.product_images
  FOR INSERT TO authenticated
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY product_images_admin_update ON public.product_images
  FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_organization_member(organization_id));

CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated
  USING (public.is_organization_member(organization_id))
  WITH CHECK (public.is_organization_member(organization_id));

CREATE POLICY sales_select ON public.sales
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE POLICY sale_items_select ON public.sale_items
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE POLICY inventory_movements_select ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

-- No se crean INSERT/UPDATE/DELETE directos para sales, sale_items ni
-- inventory_movements. La RPC transaccional existente debe operar con
-- SECURITY DEFINER y validar membership/ownership antes de escribir.

COMMENT ON COLUMN public.categories.owner_id IS
  'Compatibilidad temporal con el modelo anterior; organization_id es el límite de tenancy.';
COMMENT ON COLUMN public.products.owner_id IS
  'Compatibilidad temporal con el modelo anterior; organization_id es el límite de tenancy.';
COMMENT ON COLUMN public.clients.owner_id IS
  'Compatibilidad temporal con el modelo anterior; organization_id es el límite de tenancy.';
COMMENT ON COLUMN public.sales.owner_id IS
  'Compatibilidad temporal con el modelo anterior; organization_id es el límite de tenancy.';
