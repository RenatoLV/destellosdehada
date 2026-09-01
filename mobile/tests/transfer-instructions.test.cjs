const test = require('node:test');
const assert = require('node:assert/strict');

const { hasTransferInstructions } = require('../.test-dist/constants/transferContract.js');

const configured = {
  bankName: 'Banco de prueba',
  accountType: 'Cuenta corriente',
  accountNumber: '123',
  accountHolder: 'Tienda de prueba',
  rut: '1-9',
  email: 'test@example.com',
};

test('transfer exige el conjunto completo sin inventar valores faltantes', () => {
  assert.equal(hasTransferInstructions(configured), true);
  assert.equal(hasTransferInstructions({ ...configured, accountNumber: '' }), false);
});
