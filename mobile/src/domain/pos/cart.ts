import type { Product } from '../../types/database';
import { POSDomainError } from './errors';
import { calculateCartTotals } from './money';
import { CartItem, CartTotals } from './types';

function projectedAvailability(product: Product): number {
  // Product.stock is the projection maintained by SQLite. The POS domain does
  // not recompute pending_stock_delta or consult Supabase directly.
  return Math.max(0, Number.isInteger(product.stock) ? product.stock : 0);
}

function createCartItem(product: Product, quantity: number): CartItem {
  const availableStock = projectedAvailability(product);
  if (availableStock <= 0) {
    throw new POSDomainError('PRODUCT_UNAVAILABLE', `${product.name} no tiene stock disponible.`);
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new POSDomainError('INVALID_QUANTITY', 'La cantidad debe ser un entero mayor que cero.');
  }
  if (quantity > availableStock) {
    throw new POSDomainError('PRODUCT_STOCK_LIMIT', `Solo quedan ${availableStock} unidades de ${product.name}.`);
  }
  if (!Number.isSafeInteger(product.price) || product.price < 0) {
    throw new POSDomainError('INVALID_TOTAL', `El precio de ${product.name} no es válido.`);
  }
  return { product, quantity, unitPrice: product.price, availableStock };
}

export function addProductToCart(cart: readonly CartItem[], product: Product): CartItem[] {
  const existing = cart.find(item => item.product.id === product.id);
  if (!existing) return [...cart, createCartItem(product, 1)];

  const nextQuantity = existing.quantity + 1;
  return cart.map(item => item.product.id === product.id
    ? createCartItem(product, nextQuantity)
    : item);
}

export function setCartItemQuantity(cart: readonly CartItem[], productId: string, quantity: number): CartItem[] {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new POSDomainError('INVALID_QUANTITY', 'La cantidad debe ser un entero no negativo.');
  }
  if (quantity === 0) return removeProductFromCart(cart, productId);
  return cart.map(item => item.product.id === productId
    ? createCartItem(item.product, quantity)
    : item);
}

export function changeCartItemQuantity(cart: readonly CartItem[], productId: string, delta: number): CartItem[] {
  if (!Number.isInteger(delta)) {
    throw new POSDomainError('INVALID_QUANTITY', 'El cambio de cantidad debe ser un entero.');
  }
  const item = cart.find(current => current.product.id === productId);
  if (!item) return [...cart];
  return setCartItemQuantity(cart, productId, item.quantity + delta);
}

export function removeProductFromCart(cart: readonly CartItem[], productId: string): CartItem[] {
  return cart.filter(item => item.product.id !== productId);
}

export function clearCart(): CartItem[] {
  return [];
}

export function getCartTotals(cart: readonly CartItem[], discountAmount = 0): CartTotals {
  return calculateCartTotals(cart, { type: 'fixed', amount: discountAmount });
}

export function validateCart(cart: readonly CartItem[]): void {
  if (cart.length === 0) throw new POSDomainError('EMPTY_CART', 'Agrega al menos un producto al carrito.');
  const productIds = new Set<string>();
  for (const item of cart) {
    if (productIds.has(item.product.id)) {
      throw new POSDomainError('INVALID_QUANTITY', 'No se puede repetir un producto dentro de la venta.');
    }
    productIds.add(item.product.id);
    createCartItem(item.product, item.quantity);
  }
}
