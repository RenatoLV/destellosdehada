const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function migration(name) {
  return fs.readFileSync(path.resolve(process.cwd(), '..', 'supabase', 'migrations', name), 'utf8');
}

test('process_sale conserva idempotencia, hash canónico y recovery', () => {
  const transaction = migration('013_process_sale_transaction.sql');
  const integrity = migration('016_process_sale_integrity.sql');
  assert.match(transaction, /UNIQUE INDEX IF NOT EXISTS uq_sales_organization_idempotency/i);
  assert.match(integrity, /sale_server_payload_hash/i);
  assert.match(integrity, /IDEMPOTENCY_PAYLOAD_MISMATCH/g);
  assert.match(integrity, /ORDER BY product_id/i);
  assert.match(integrity, /FOR UPDATE/i);
  assert.match(integrity, /stock >= v_item\.quantity/i);
  assert.match(integrity, /get_sale_by_idempotency_key/i);
  assert.match(integrity, /NOT_ORGANIZATION_MEMBER/i);
});

test('receipt requiere reserva previa y Storage privado', () => {
  const receipts = migration('014_receipts.sql');
  const attach = migration('015_attach_receipt.sql');
  const reservation = migration('017_receipt_reservations.sql');
  assert.match(receipts, /'sale-receipts', 'sale-receipts', FALSE/i);
  assert.match(reservation, /CREATE OR REPLACE FUNCTION public\.reserve_receipt/i);
  assert.match(reservation, /receipt\.storage_path = storage\.objects\.name/i);
  assert.match(reservation, /public\.is_organization_member\(receipt\.organization_id\)/i);
  assert.match(attach, /RECEIPT_NOT_UPLOADED/i);
  assert.match(attach, /PAYMENT_SALE_MISMATCH/i);
});

test('policies efectivas 011-017 no abren acceso universal', () => {
  const effective = [
    '011_organization_rls.sql',
    '012_payments.sql',
    '013_process_sale_transaction.sql',
    '014_receipts.sql',
    '015_attach_receipt.sql',
    '016_process_sale_integrity.sql',
    '017_receipt_reservations.sql',
  ].map(migration).join('\n');
  assert.doesNotMatch(effective, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(effective, /WITH CHECK\s*\(\s*true\s*\)/i);
});

test('Edge Function usa JWT del caller y no service role', () => {
  const edge = fs.readFileSync(
    path.resolve(process.cwd(), '..', 'supabase', 'functions', 'process-sale', 'index.ts'),
    'utf8',
  );
  assert.match(edge, /Authorization: authorization/);
  assert.match(edge, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(edge, /SERVICE_ROLE/);
  assert.match(edge, /rpc\('process_sale'/);
});

test('bootstrap inicial usa auth.uid, es atómico y se cierra después de la primera organización', () => {
  const bootstrap = migration('018_bootstrap_first_organization.sql');
  assert.match(bootstrap, /v_user_id UUID := auth\.uid\(\)/i);
  assert.match(bootstrap, /pg_advisory_xact_lock/i);
  assert.match(bootstrap, /ORGANIZATION_BOOTSTRAP_CLOSED/i);
  assert.match(bootstrap, /VALUES \(v_organization\.id, v_user_id, 'owner', TRUE\)/i);
  assert.doesNotMatch(bootstrap, /p_user_id/i);
  assert.match(bootstrap, /REVOKE ALL .* FROM anon/i);
  assert.match(bootstrap, /GRANT EXECUTE .* TO authenticated/i);
});

test('hash server-side resuelve pgcrypto explícitamente y usa volatilidad compatible', () => {
  const hashFix = migration('019_fix_server_payload_hash.sql');
  assert.match(hashFix, /extensions\.digest/i);
  assert.match(hashFix, /LANGUAGE plpgsql\s+STABLE/i);
  assert.doesNotMatch(hashFix, /\bIMMUTABLE\b/i);
});

test('alta de producto exige rol admin y registra stock inicial atómicamente', () => {
  const productAdmin = migration('020_create_product_admin.sql');
  assert.match(productAdmin, /is_organization_admin\(p_organization_id\)/);
  assert.match(productAdmin, /INSERT INTO public\.products/);
  assert.match(productAdmin, /INSERT INTO public\.inventory_movements/);
  assert.match(productAdmin, /REVOKE ALL ON FUNCTION public\.create_product_admin/);
  assert.doesNotMatch(productAdmin, /USING\s*\(\s*true\s*\)/i);
});

test('upload de imagen usa JWT y secretos server-side, nunca service role', () => {
  const edge = fs.readFileSync(
    path.resolve(process.cwd(), '..', 'supabase', 'functions', 'upload-product-image', 'index.ts'),
    'utf8',
  );
  assert.match(edge, /supabase\.auth\.getUser\(\)/);
  assert.match(edge, /GOOGLE_DRIVE_UPLOAD_URL/);
  assert.match(edge, /GOOGLE_DRIVE_UPLOAD_PASSWORD/);
  assert.match(edge, /\.in\('role', \['owner', 'admin'\]\)/);
  assert.doesNotMatch(edge, /SERVICE_ROLE_KEY/);
  assert.doesNotMatch(edge, /uploadPassword\s*=\s*['"][^'"]+['"]/);
});

test('galería de producto conserva una sola imagen principal y hasta tres cargas locales', () => {
  const primary = migration('023_product_image_primary.sql');
  const edge = fs.readFileSync(
    path.resolve(process.cwd(), '..', 'supabase', 'functions', 'upload-product-image', 'index.ts'),
    'utf8',
  );
  const products = fs.readFileSync(
    path.resolve(process.cwd(), 'src', 'database', 'products.ts'),
    'utf8',
  );
  assert.match(primary, /is_organization_admin\(p_organization_id\)/i);
  assert.match(primary, /CASE WHEN id = p_image_id THEN 1 ELSE 0 END/i);
  assert.match(primary, /REVOKE ALL ON FUNCTION public\.set_product_primary_image/i);
  assert.match(edge, /is_primary: isPrimary/);
  assert.match(edge, /sort_order: sortOrder/);
  assert.match(products, /input\.images\.slice\(0, 3\)/);
});

test('ajuste administrativo de stock es atómico, auditado e idempotente', () => {
  const stock = migration('022_adjust_stock_admin.sql');
  assert.match(stock, /is_organization_admin\(p_organization_id\)/i);
  assert.match(stock, /FOR UPDATE/i);
  assert.match(stock, /v_product\.stock <> v_stock_before/i);
  assert.match(stock, /INSERT INTO public\.inventory_movements/i);
  assert.match(stock, /MOVEMENT_PAYLOAD_MISMATCH/i);
  assert.match(stock, /REVOKE ALL ON FUNCTION public\.adjust_stock_admin/i);
});
