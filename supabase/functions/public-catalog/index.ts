import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const { organization_id: organizationId } = await request.json();
    if (typeof organizationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
      return json({ success: false, code: 'INVALID_ORGANIZATION' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, code: 'SERVER_CONFIGURATION_ERROR' }, 500);
    }

    // The privileged key stays server-side. Only explicitly selected public
    // storefront fields are returned; cost, supplier and ownership are omitted.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .is('deleted_at', null)
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization) return json({ success: true, products: [] });

    const { data, error } = await admin
      .from('products')
      .select(`
        id, organization_id, sku, name, description, type, created_at,
        category_id, price, stock,
        categories(name),
        product_images(local_uri, storage_path, is_primary, sort_order)
      `)
      .eq('organization_id', organizationId)
      .eq('active', 1)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (error) throw error;

    return json({ success: true, products: data ?? [] });
  } catch (error) {
    console.error('public-catalog error', error);
    return json({ success: false, code: 'CATALOG_UNAVAILABLE' }, 500);
  }
});
