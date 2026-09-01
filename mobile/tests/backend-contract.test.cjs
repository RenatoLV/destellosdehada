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
