-- Corrige la resolución de pgcrypto en Supabase y la volatilidad reportada
-- por plpgsql_check. El contrato y la representación canónica no cambian.

CREATE OR REPLACE FUNCTION public.sale_server_payload_hash(
  p_sale JSONB,
  p_organization_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonical JSONB;
BEGIN
  IF p_sale IS NULL OR p_organization_id IS NULL
     OR jsonb_typeof(p_sale->'items') <> 'array' THEN
    RETURN NULL;
  END IF;

  v_canonical := jsonb_build_object(
    'organization_id', p_organization_id::TEXT,
    'client_id', NULLIF(p_sale->>'client_id', ''),
    'discount', COALESCE(NULLIF(p_sale->>'discount', '')::INTEGER, 0),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', item->>'product_id',
          'quantity', (item->>'quantity')::INTEGER
        )
        ORDER BY item->>'product_id', item->>'quantity'
      )
      FROM jsonb_array_elements(p_sale->'items') AS item
    ), '[]'::JSONB)
  );

  RETURN encode(
    extensions.digest(v_canonical::TEXT, 'sha256'::TEXT),
    'hex'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sale_server_payload_hash(JSONB, UUID)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sale_server_payload_hash(JSONB, UUID) IS
  'Calcula la huella SHA-256 canónica server-side usando pgcrypto desde el schema extensions.';
