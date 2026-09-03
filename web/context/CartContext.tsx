/**
 * context/CartContext.tsx
 * Estado global del carrito y cálculos de la venta.
 * Soporta operaciones de agregar, modificar cantidad, eliminar con soporte de deshacer (Undo),
 * y descuentos porcentuales o de monto fijo.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '@/services/catalog';

export type CartLine = { product: Product; quantity: number };
export type DiscountType = 'percent' | 'amount';
export type Discount = { type: DiscountType; value: number } | null;

type CartContextValue = {
  lines: CartLine[];
  addProduct: (product: Product, quantity?: number) => void;
  incrementQty: (productId: string) => void;
  decrementQty: (productId: string) => void;
  removeProduct: (productId: string) => CartLine | null;
  undoRemove: () => void;
  clear: () => void;
  discount: Discount;
  setDiscount: (discount: Discount) => void;
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  lastRemoved: CartLine | null;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = 'destellos_cart_v1';

function readStoredCart(): { lines: CartLine[]; discount: Discount } {
  if (typeof window === 'undefined' || !window.localStorage) return { lines: [], discount: null };

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { lines: [], discount: null };
    const parsed = JSON.parse(raw);
    const safeLines = Array.isArray(parsed?.lines)
      ? parsed.lines.filter(
          (line: CartLine) =>
            line?.product?.id &&
            Number.isFinite(line.quantity) &&
            line.quantity > 0
        )
      : [];
    const safeDiscount =
      parsed?.discount &&
      (parsed.discount.type === 'percent' || parsed.discount.type === 'amount') &&
      Number.isFinite(parsed.discount.value)
        ? parsed.discount
        : null;
    return { lines: safeLines, discount: safeDiscount };
  } catch {
    return { lines: [], discount: null };
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const storedCart = useMemo(readStoredCart, []);
  const [lines, setLines] = useState<CartLine[]>(storedCart.lines);
  const [discount, setDiscount] = useState<Discount>(storedCart.discount);
  const [lastRemoved, setLastRemoved] = useState<CartLine | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ lines, discount }));
    } catch (error) {
      console.warn('No fue posible guardar el carrito', error);
    }
  }, [lines, discount]);

  const addProduct = (product: Product, qty: number = 1) => {
    if (product.availability === 'agotado' || product.stock <= 0) return;
    const safeQty = Math.min(product.stock, Math.max(1, Math.floor(Number(qty) || 1)));
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, product, quantity: Math.min(product.stock, l.quantity + safeQty) }
            : l
        );
      }
      return [...prev, { product, quantity: safeQty }];
    });
  };

  const incrementQty = (productId: string) =>
    setLines((prev) =>
      prev.map((l) => (l.product.id === productId
        ? { ...l, quantity: Math.min(l.product.stock, l.quantity + 1) }
        : l))
    );

  const decrementQty = (productId: string) =>
    setLines((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    );

  const removeProduct = (productId: string): CartLine | null => {
    const itemToRemove = lines.find((l) => l.product.id === productId) || null;
    if (itemToRemove) {
      setLastRemoved(itemToRemove);
      setLines((prev) => prev.filter((l) => l.product.id !== productId));
    }
    return itemToRemove;
  };

  const undoRemove = () => {
    if (!lastRemoved) return;
    setLines((prev) => {
      const exists = prev.find((l) => l.product.id === lastRemoved.product.id);
      if (exists) {
        return prev.map((l) =>
          l.product.id === lastRemoved.product.id
            ? { ...l, quantity: l.quantity + lastRemoved.quantity }
            : l
        );
      }
      return [...prev, lastRemoved];
    });
    setLastRemoved(null);
  };

  const clear = () => {
    setLines([]);
    setDiscount(null);
    setLastRemoved(null);
  };

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    [lines]
  );

  const discountAmount = useMemo(() => {
    if (!discount) return 0;
    const safeValue = Math.max(0, discount.value);
    if (discount.type === 'percent') {
      const safePct = Math.min(100, safeValue);
      return Math.round((subtotal * safePct) / 100);
    }
    return Math.min(safeValue, subtotal);
  }, [discount, subtotal]);

  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        lines,
        addProduct,
        incrementQty,
        decrementQty,
        removeProduct,
        undoRemove,
        clear,
        discount,
        setDiscount,
        subtotal,
        discountAmount,
        total,
        itemCount,
        lastRemoved,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
