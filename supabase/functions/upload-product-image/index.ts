import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBase64Characters = 11_200_000;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return response({ success: false, code: 'UNAUTHENTICATED' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return response({ success: false, code: 'UNAUTHENTICATED' }, 401);

  try {
    const body = await request.json();
    const organizationId = typeof body?.organization_id === 'string' ? body.organization_id : '';
    const productId = typeof body?.product_id === 'string' ? body.product_id : '';
    const imageId = typeof body?.image_id === 'string' ? body.image_id : '';
    const mimeType = typeof body?.mime_type === 'string' ? body.mime_type : '';
    const fileName = typeof body?.file_name === 'string' ? body.file_name : '';
    const base64 = typeof body?.base64 === 'string' ? body.base64 : '';
    const isPrimary = Number(body?.is_primary) === 1 ? 1 : 0;
    const sortOrder = Number.isInteger(Number(body?.sort_order)) && Number(body.sort_order) >= 0
      ? Number(body.sort_order)
      : 0;
    if (!organizationId || !productId || !imageId || !fileName || !base64
      || !allowedMimeTypes.has(mimeType) || base64.length > maxBase64Characters) {
      return response({ success: false, code: 'INVALID_IMAGE_PAYLOAD' }, 422);
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', authData.user.id)
      .eq('active', true)
      .in('role', ['owner', 'admin'])
      .maybeSingle();
    if (membershipError || !membership) return response({ success: false, code: 'ADMIN_REQUIRED' }, 403);

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (productError || !product) return response({ success: false, code: 'PRODUCT_NOT_FOUND' }, 404);

    const { data: existing } = await supabase
      .from('product_images')
      .select('id, local_uri, storage_path')
      .eq('id', imageId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (existing?.local_uri?.startsWith('http')) {
      return response({
        success: true,
        idempotent: true,
        image_id: existing.id,
        file_url: existing.local_uri,
        file_id: existing.storage_path,
      });
    }

    const uploadUrl = Deno.env.get('GOOGLE_DRIVE_UPLOAD_URL');
    const uploadPassword = Deno.env.get('GOOGLE_DRIVE_UPLOAD_PASSWORD');
    if (!uploadUrl || !uploadPassword) {
      return response({ success: false, code: 'IMAGE_STORAGE_NOT_CONFIGURED' }, 503);
    }

    const driveResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: uploadPassword,
        carpeta: 'joyas',
        base64,
        mimeType,
        fileName: `${organizationId}-${productId}-${imageId}-${fileName}`,
      }),
    });
    if (!driveResponse.ok) return response({ success: false, code: 'IMAGE_UPLOAD_FAILED' }, 502);
    const driveResult = await driveResponse.json();
    if (driveResult?.success !== true || typeof driveResult.fileUrl !== 'string'
      || typeof driveResult.fileId !== 'string') {
      return response({ success: false, code: 'IMAGE_UPLOAD_FAILED' }, 502);
    }

    const updatedAt = new Date().toISOString();
    if (isPrimary === 1) {
      const { error: previousPrimaryError } = await supabase
        .from('product_images')
        .update({ is_primary: 0, updated_at: updatedAt })
        .eq('organization_id', organizationId)
        .eq('product_id', productId)
        .neq('id', imageId);
      if (previousPrimaryError) {
        return response({ success: false, code: 'IMAGE_PRIMARY_UPDATE_FAILED' }, 409);
      }
    }

    const { error: imageError } = await supabase.from('product_images').upsert({
      id: imageId,
      organization_id: organizationId,
      owner_id: authData.user.id,
      product_id: productId,
      local_uri: driveResult.fileUrl,
      storage_path: driveResult.fileId,
      is_primary: isPrimary,
      sort_order: sortOrder,
      created_at: typeof body.created_at === 'string' ? body.created_at : new Date().toISOString(),
      updated_at: updatedAt,
    });
    if (imageError) return response({ success: false, code: 'IMAGE_METADATA_FAILED' }, 409);

    return response({
      success: true,
      idempotent: false,
      image_id: imageId,
      file_url: driveResult.fileUrl,
      file_id: driveResult.fileId,
    });
  } catch {
    return response({ success: false, code: 'INVALID_JSON' }, 400);
  }
});
