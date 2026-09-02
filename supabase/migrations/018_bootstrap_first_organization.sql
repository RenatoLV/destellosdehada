-- Permite crear la primera organización sin abrir INSERT directo por RLS.
-- Solo el primer usuario autenticado puede ejecutar el bootstrap; después,
-- los usuarios adicionales deben recibir una membership explícita.

CREATE OR REPLACE FUNCTION public.bootstrap_first_organization(
  p_name TEXT DEFAULT 'Destellos de Hada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_organization public.organizations%ROWTYPE;
  v_existing RECORD;
  v_name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;

  -- Serializa el bootstrap global para impedir dos organizaciones iniciales.
  PERFORM pg_advisory_xact_lock(hashtext('destellos.bootstrap_first_organization'));

  SELECT organization.id AS organization_id, organization.name, membership.role
  INTO v_existing
  FROM public.memberships AS membership
  JOIN public.organizations AS organization
    ON organization.id = membership.organization_id
  WHERE membership.user_id = v_user_id
    AND membership.active = TRUE
    AND organization.deleted_at IS NULL
  ORDER BY membership.created_at, membership.organization_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'organization_id', v_existing.organization_id,
      'name', v_existing.name,
      'role', v_existing.role
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organizations WHERE deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ORGANIZATION_BOOTSTRAP_CLOSED'
    );
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ORGANIZATION_NAME');
  END IF;

  INSERT INTO public.organizations (name)
  VALUES (v_name)
  RETURNING * INTO v_organization;

  INSERT INTO public.memberships (organization_id, user_id, role, active)
  VALUES (v_organization.id, v_user_id, 'owner', TRUE);

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'organization_id', v_organization.id,
    'name', v_organization.name,
    'role', 'owner'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_organization(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_first_organization(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_organization(TEXT) TO authenticated;

COMMENT ON FUNCTION public.bootstrap_first_organization(TEXT) IS
  'Crea atómicamente la primera organización y asigna auth.uid() como owner; reintentos del mismo usuario son idempotentes.';
