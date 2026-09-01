import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client, Product } from '../types/database';
import {
  addProductToCart,
  advanceCheckout,
  calculateCartTotals,
  changeCartItemQuantity,
  checkoutStateFromSaleResult,
  createInitialCheckoutState,
  createSaleDraft,
  getPOSSaleResult,
  POSDomainError,
  POSSession,
  parseFixedDiscount,
  ReceiptSelection,
  removeProductFromCart,
  retreatCheckout,
  SaleDraft,
  submitCheckout,
} from '../domain/pos';
import { getActiveOrganizationContext } from '../services/organizationContext';
import { inspectLocalReceiptFile, isReceiptMimeType } from '../services/receiptStorage';
import { useSync } from '../sync/useSync';
import { CheckoutReceiptStatus, getCheckoutReceiptStatus } from '../database/receipts';

function messageFromError(error: unknown): string {
  if (error instanceof POSDomainError || error instanceof Error) return error.message;
  return 'No fue posible completar esta acción.';
}

export function useCheckout() {
  const sync = useSync();
  const [session, setSession] = useState<POSSession | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSelection | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<CheckoutReceiptStatus>('pending');
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void getActiveOrganizationContext()
      .then(context => {
        if (!active) return;
        setSession({
          organizationId: context.organizationId,
          userId: context.userId,
          cart: [],
          client: null,
          discount: { type: 'fixed', amount: 0 },
          notes: '',
          checkout: createInitialCheckoutState(),
        });
      })
      .catch(error => {
        if (active) setMessage(messageFromError(error));
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => session
    ? calculateCartTotals(session.cart, session.discount)
    : { subtotal: 0, discount: 0, total: 0, totalItems: 0 }, [session]);

  const draft = useMemo<SaleDraft | null>(() => {
    if (!session || session.cart.length === 0) return null;
    try {
      return createSaleDraft(session.organizationId, {
        cart: session.cart,
        client: session.client,
        discount: session.discount,
        notes: session.notes,
      });
    } catch {
      return null;
    }
  }, [session]);

  const updateCart = useCallback((operation: (cart: POSSession['cart']) => POSSession['cart']) => {
    setSession(current => {
      if (!current || current.checkout.step !== 'cart') return current;
      try {
        const cart = operation(current.cart);
        let discount = current.discount;
        try {
          calculateCartTotals(cart, discount);
        } catch {
          discount = { type: 'fixed', amount: 0 };
          setMessage('El descuento se eliminó porque superaba el nuevo subtotal.');
        }
        return { ...current, cart, discount };
      } catch (error) {
        setMessage(messageFromError(error));
        return current;
      }
    });
  }, []);

  const addProduct = useCallback((product: Product) => {
    setMessage(null);
    updateCart(cart => addProductToCart(cart, product));
  }, [updateCart]);

  const changeQuantity = useCallback((productId: string, delta: number) => {
    setMessage(null);
    updateCart(cart => changeCartItemQuantity(cart, productId, delta));
  }, [updateCart]);

  const removeProduct = useCallback((productId: string) => {
    setMessage(null);
    updateCart(cart => removeProductFromCart(cart, productId));
  }, [updateCart]);

  const applyDiscount = useCallback((value: string | number) => {
    setSession(current => {
      if (!current || current.checkout.step !== 'cart') return current;
      try {
        const amount = parseFixedDiscount(value);
        const discount = { type: 'fixed' as const, amount };
        calculateCartTotals(current.cart, discount);
        setMessage(amount > 0 ? 'Descuento aplicado.' : null);
        return { ...current, discount };
      } catch (error) {
        setMessage(messageFromError(error));
        return current;
      }
    });
  }, []);

  const setClient = useCallback((client: Client | null) => {
    setSession(current => current ? { ...current, client } : current);
  }, []);

  const setNotes = useCallback((notes: string) => {
    setSession(current => current ? { ...current, notes } : current);
  }, []);

  const selectReceipt = useCallback(async (selection: ReceiptSelection) => {
    setMessage(null);
    try {
      if (!isReceiptMimeType(selection.mimeType)) throw new Error('El formato del comprobante no está permitido.');
      const inspected = await inspectLocalReceiptFile(selection.localUri);
      setReceipt({ ...selection, fileSize: inspected.size, checksum: inspected.checksum });
    } catch (error) {
      setMessage(messageFromError(error));
      throw error;
    }
  }, []);

  const removeReceipt = useCallback(() => {
    if (submittingRef.current) return;
    setReceipt(null);
    setMessage(null);
  }, []);

  const continueCheckout = useCallback(() => {
    if (!session) return;
    try {
      if (!draft) throw new POSDomainError('EMPTY_CART', 'Agrega al menos un producto al carrito.');
      const next = advanceCheckout(session.checkout, draft, Boolean(receipt));
      setMessage(null);
      setSession(current => current ? { ...current, checkout: next } : current);
    } catch (error) {
      setMessage(messageFromError(error));
    }
  }, [draft, receipt, session]);

  const backCheckout = useCallback(() => {
    setSession(current => {
      if (!current) return current;
      try {
        return { ...current, checkout: retreatCheckout(current.checkout) };
      } catch (error) {
        setMessage(messageFromError(error));
        return current;
      }
    });
  }, []);

  const refreshSaleResult = useCallback(async (saleId: string) => {
    const result = await getPOSSaleResult(saleId);
    if (!result) return;
    setSession(current => current ? {
      ...current,
      checkout: checkoutStateFromSaleResult(result),
    } : current);
  }, []);

  const refreshReceiptStatus = useCallback(async (id: string) => {
    setReceiptStatus(await getCheckoutReceiptStatus(id));
  }, []);

  const submit = useCallback(async () => {
    if (!session || !draft || !receipt || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const processing = advanceCheckout(session.checkout, draft, true);
      setSession(current => current ? { ...current, checkout: processing } : current);
      const result = await submitCheckout(draft, receipt);
      setReceiptId(result.receiptId);
      if (result.receiptId) await refreshReceiptStatus(result.receiptId);
      setSession(current => current ? {
        ...current,
        checkout: checkoutStateFromSaleResult(result),
      } : current);
      if (result.receiptError) setMessage(`La venta quedó guardada, pero el comprobante requiere atención: ${result.receiptError}`);
      if (sync.isOnline) {
        await sync.syncNow();
        await refreshSaleResult(result.saleId);
        if (result.receiptId) await refreshReceiptStatus(result.receiptId);
      }
    } catch (error) {
      setMessage(messageFromError(error));
      setSession(current => current && current.checkout.step === 'processing'
        ? { ...current, checkout: { ...current.checkout, step: 'receipt' } }
        : current);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [draft, receipt, refreshReceiptStatus, refreshSaleResult, session, sync]);

  useEffect(() => {
    const saleId = session?.checkout.saleId;
    if (!saleId || submitting || sync.isSyncing) return;
    void refreshSaleResult(saleId);
  }, [refreshSaleResult, session?.checkout.saleId, submitting, sync.isSyncing, sync.lastSyncTime]);

  useEffect(() => {
    if (!receiptId || submitting || sync.isSyncing) return;
    void refreshReceiptStatus(receiptId);
  }, [receiptId, refreshReceiptStatus, submitting, sync.isSyncing, sync.lastSyncTime]);

  const reset = useCallback(() => {
    setSession(current => current ? {
      ...current,
      cart: [],
      client: null,
      discount: { type: 'fixed', amount: 0 },
      notes: '',
      checkout: createInitialCheckoutState(),
    } : current);
    setReceipt(null);
    setReceiptId(null);
    setReceiptStatus('pending');
    setMessage(null);
  }, []);

  return {
    session,
    draft,
    totals,
    receipt,
    receiptId,
    receiptStatus,
    initializing,
    submitting,
    message,
    sync,
    addProduct,
    changeQuantity,
    removeProduct,
    applyDiscount,
    setClient,
    setNotes,
    selectReceipt,
    removeReceipt,
    continueCheckout,
    backCheckout,
    submit,
    reset,
  };
}
