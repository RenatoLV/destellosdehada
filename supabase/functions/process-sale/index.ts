import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'not_authenticated' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );

  const { error: authError } = await supabase.auth.getUser();
  if (authError) {
    return new Response(JSON.stringify({ error: 'not_authenticated' }), { status: 401, headers: corsHeaders });
  }

  try {
    const sale = await request.json();
    const { data, error } = await supabase.rpc('process_sale', {
      p_sale: sale,
      p_organization_id: sale?.organization_id,
      p_idempotency_key: sale?.idempotency_key,
      p_payload_hash: sale?.payload_hash,
    });
    if (error) {
      return new Response(JSON.stringify({ error: 'internal_error', code: error.code }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: corsHeaders });
  }
});
