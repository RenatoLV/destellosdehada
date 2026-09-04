-- Selección atómica de la imagen principal de un producto.

CREATE OR REPLACE FUNCTION public.set_product_primary_image(
  p_organization_id UUID,
  p_product_id TEXT,
  p_image_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF p_organization_id IS NULL OR NULLIF(btrim(p_product_id), '') IS NULL
     OR NULLIF(btrim(p_image_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD');
  END IF;
  IF NOT public.is_organization_admin(p_organization_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ADMIN_REQUIRED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.product_images
    WHERE id = p_image_id
      AND product_id = p_product_id
      AND organization_id = p_organization_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMAGE_NOT_FOUND');
  END IF;

  UPDATE public.product_images
  SET is_primary = CASE WHEN id = p_image_id THEN 1 ELSE 0 END,
      updated_at = NOW()
  WHERE product_id = p_product_id
    AND organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'image_id', p_image_id,
    'product_id', p_product_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_primary_image(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_product_primary_image(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_product_primary_image(UUID, TEXT, TEXT) IS
  'Selecciona una única imagen principal por producto para owners/admins.';
