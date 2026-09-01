const test = require('node:test');
const assert = require('node:assert/strict');

const receipt = require('../.test-dist/services/receiptContract.js');

test('receipt genera una ruta determinista organization/sale/receipt', () => {
  assert.equal(
    receipt.buildReceiptStoragePath('org-id', 'sale-id', 'receipt-id', 'image/png'),
    'org-id/sale-id/receipt-id.png',
  );
  assert.equal(receipt.isReceiptMimeType('application/pdf'), true);
  assert.equal(receipt.isReceiptMimeType('text/html'), false);
  assert.equal(receipt.MAX_RECEIPT_BYTES, 10 * 1024 * 1024);
});

test('receipt rechaza segmentos manipulados', () => {
  assert.throws(() => receipt.buildReceiptStoragePath('org/a', 'sale', 'receipt', 'image/jpeg'));
  assert.throws(() => receipt.buildReceiptStoragePath('org', '../sale', 'receipt', 'image/jpeg'));
});
