import { POSDomainError } from './errors';
import { CartItem, CartTotals, Discount } from './types';

function assertNonNegativeInteger(value: number, code: 'INVALID_DISCOUNT' | 'INVALID_TOTAL', label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new POSDomainError(code, `${label} debe ser un entero no negativo.`);
  }
}

export function parseFixedDiscount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    assertNonNegativeInteger(value, 'INVALID_DISCOUNT', 'El descuento');
    return value;
  }
  const normalized = value.trim();
  if (normalized.startsWith('-')) {
    throw new POSDomainError('INVALID_DISCOUNT', 'El descuento no puede ser negativo.');
  }
  const digits = normalized.replace(/\D/g, '');
  if (!digits) return 0;
  const amount = Number(digits);
  assertNonNegativeInteger(amount, 'INVALID_DISCOUNT', 'El descuento');
  return amount;
}

export function calculateSubtotal(items: readonly CartItem[]): number {
  let subtotal = 0;
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new POSDomainError('INVALID_QUANTITY', 'La cantidad debe ser un entero mayor que cero.');
    }
    assertNonNegativeInteger(item.unitPrice, 'INVALID_TOTAL', 'El precio');
    subtotal += item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(subtotal)) {
      throw new POSDomainError('INVALID_TOTAL', 'El subtotal excede el límite permitido.');
    }
  }
  return subtotal;
}

export function calculateDiscount(subtotal: number, discount: Discount): number {
  assertNonNegativeInteger(subtotal, 'INVALID_TOTAL', 'El subtotal');
  if (discount.type !== 'fixed') {
    throw new POSDomainError('INVALID_DISCOUNT', 'El tipo de descuento no está soportado.');
  }
  assertNonNegativeInteger(discount.amount, 'INVALID_DISCOUNT', 'El descuento');
  if (discount.amount > subtotal) {
    throw new POSDomainError('INVALID_DISCOUNT', 'El descuento no puede superar el subtotal.');
  }
  return discount.amount;
}

export function calculateTotal(subtotal: number, discount: Discount): number {
  const discountAmount = calculateDiscount(subtotal, discount);
  const total = subtotal - discountAmount;
  assertNonNegativeInteger(total, 'INVALID_TOTAL', 'El total');
  return total;
}

export function calculateCartTotals(items: readonly CartItem[], discount: Discount = { type: 'fixed', amount: 0 }): CartTotals {
  const subtotal = calculateSubtotal(items);
  const discountAmount = calculateDiscount(subtotal, discount);
  return {
    subtotal,
    discount: discountAmount,
    total: calculateTotal(subtotal, discount),
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export function formatCurrency(amount: number): string {
  assertNonNegativeInteger(amount, 'INVALID_TOTAL', 'El importe');
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}
