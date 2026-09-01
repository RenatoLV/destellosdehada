const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifySyncFailure,
  isStockConflict,
  isTransportUncertainty,
} = require('../.test-dist/sync/syncPolicy.js');

test('timeout y 5xx conservan la reserva y activan recovery', () => {
  assert.deepEqual(classifySyncFailure({ status: 408, message: 'timeout' }, 1, 5), {
    queueStatus: 'failed', retryable: true, saleDisposition: 'recover',
  });
  assert.deepEqual(classifySyncFailure({ status: 503, message: 'unavailable' }, 5, 5), {
    queueStatus: 'blocked', retryable: true, saleDisposition: 'recover',
  });
  assert.equal(isTransportUncertainty({ status: 500, message: 'server error' }), true);
});

test('rechazo permanente libera reserva incluso en MAX_ATTEMPTS', () => {
  assert.deepEqual(classifySyncFailure({
    code: 'INVALID_PAYLOAD', status: 409, message: 'invalid',
  }, 5, 5), {
    queueStatus: 'blocked', retryable: false, saleDisposition: 'release',
  });
});

test('stock y precio son conflictos permanentes, no incertidumbre', () => {
  for (const code of ['STOCK_INSUFFICIENT', 'PRICE_CHANGED']) {
    const error = { code, status: 409, message: code };
    assert.equal(isStockConflict(error), true);
    assert.equal(isTransportUncertainty(error), false);
    assert.equal(classifySyncFailure(error, 1, 5).saleDisposition, 'release');
  }
});
