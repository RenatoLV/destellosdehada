const test = require('node:test');
const assert = require('node:assert/strict');

const cart = require('../.test-dist/domain/pos/cart.js');
const checkout = require('../.test-dist/domain/pos/checkout.js');
const money = require('../.test-dist/domain/pos/money.js');

function product(overrides = {}) {
  return {
    id: 'product-1', organization_id: 'organization-1', name: 'Anillo Aura',
    description: null, category_id: null, type: null, price: 1990, cost: 0,
    stock: 3, sku: null, supplier: null, active: 1,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null, ...overrides,
  };
}

function draft() {
  const items = cart.addProductToCart([], product());
  return {
    organizationId: 'organization-1', clientId: null, clientName: null, items,
    discount: { type: 'fixed', amount: 0 }, subtotal: 1990, total: 1990, notes: null,
  };
}

test('cart agrega, agrupa duplicados, cambia cantidades, elimina y vacía', () => {
  const item = product();
  let state = cart.addProductToCart([], item);
  assert.equal(state.length, 1);
  assert.equal(state[0].quantity, 1);
  state = cart.addProductToCart(state, item);
  assert.equal(state.length, 1);
  assert.equal(state[0].quantity, 2);
  state = cart.changeCartItemQuantity(state, item.id, -1);
  assert.equal(state[0].quantity, 1);
  state = cart.setCartItemQuantity(state, item.id, 0);
  assert.deepEqual(state, []);
  assert.deepEqual(cart.clearCart(), []);
  assert.deepEqual(cart.removeProductFromCart(cart.addProductToCart([], item), item.id), []);
});

test('cart rechaza stock cero y cantidades sobre el stock proyectado', () => {
  assert.throws(
    () => cart.addProductToCart([], product({ stock: 0 })),
    error => error.code === 'PRODUCT_UNAVAILABLE',
  );
  const oneAvailable = product({ stock: 1 });
  const state = cart.addProductToCart([], oneAvailable);
  assert.throws(
    () => cart.addProductToCart(state, oneAvailable),
    error => error.code === 'PRODUCT_STOCK_LIMIT',
  );
});

test('money conserva enteros CLP y calcula subtotal, descuento y total', () => {
  const items = [
    { product: product({ id: 'p1', price: 1000 }), quantity: 1, unitPrice: 1000, availableStock: 5 },
    { product: product({ id: 'p2', price: 1990 }), quantity: 2, unitPrice: 1990, availableStock: 5 },
    { product: product({ id: 'p3', price: 25990 }), quantity: 1, unitPrice: 25990, availableStock: 5 },
  ];
  const totals = money.calculateCartTotals(items, { type: 'fixed', amount: 990 });
  assert.deepEqual(totals, { subtotal: 30970, discount: 990, total: 29980, totalItems: 4 });
  assert.equal(Number.isInteger(totals.total), true);
});

test('discount acepta cero y subtotal, pero rechaza negativos y excesos', () => {
  assert.equal(money.calculateTotal(1000, { type: 'fixed', amount: 0 }), 1000);
  assert.equal(money.calculateTotal(1000, { type: 'fixed', amount: 1000 }), 0);
  assert.throws(() => money.parseFixedDiscount(-1), error => error.code === 'INVALID_DISCOUNT');
  assert.throws(() => money.parseFixedDiscount('-100'), error => error.code === 'INVALID_DISCOUNT');
  assert.throws(
    () => money.calculateTotal(1000, { type: 'fixed', amount: 1001 }),
    error => error.code === 'INVALID_DISCOUNT',
  );
});

test('checkout solo permite la transición lineal siguiente', () => {
  const saleDraft = draft();
  const initial = checkout.createInitialCheckoutState();
  assert.equal(checkout.advanceCheckout(initial, saleDraft).step, 'client');
  assert.throws(
    () => checkout.transitionCheckout(initial, 'receipt', saleDraft),
    error => error.code === 'INVALID_CHECKOUT_TRANSITION',
  );
  assert.throws(
    () => checkout.transitionCheckout(initial, 'confirmation', saleDraft),
    error => error.code === 'INVALID_CHECKOUT_TRANSITION',
  );
  assert.throws(
    () => checkout.advanceCheckout({ step: 'processing' }, saleDraft, true),
    error => error.code === 'INVALID_CHECKOUT_TRANSITION',
  );
  assert.throws(
    () => checkout.transitionCheckout(
      { step: 'confirmation', saleStatus: 'confirmed' }, 'processing', saleDraft, true,
    ),
    error => error.code === 'INVALID_CHECKOUT_TRANSITION',
  );
  assert.throws(
    () => checkout.advanceCheckout({ step: 'receipt' }, saleDraft, false),
    error => error.code === 'INVALID_CHECKOUT_TRANSITION',
  );
});
