import { POSDomainError } from './errors';
import { validateCart } from './cart';
import { CheckoutState, CheckoutStep, SaleDraft } from './types';

export const CHECKOUT_STEPS: readonly CheckoutStep[] = [
  'cart', 'client', 'transfer', 'receipt', 'processing', 'confirmation',
];

export function createInitialCheckoutState(): CheckoutState {
  return { step: 'cart' };
}

export function validateCheckoutStep(step: CheckoutStep, draft?: SaleDraft, hasReceipt = false): void {
  if (step === 'cart' && draft) validateCart(draft.items);
  if (step === 'transfer' && draft && draft.total < 0) {
    throw new POSDomainError('INVALID_TOTAL', 'El total no puede ser negativo.');
  }
  if (step === 'receipt' && !hasReceipt) {
    throw new POSDomainError('INVALID_CHECKOUT_TRANSITION', 'El comprobante aún no ha sido seleccionado.');
  }
}

export function advanceCheckout(state: CheckoutState, draft?: SaleDraft, hasReceipt = false): CheckoutState {
  const nextStep = CHECKOUT_STEPS[CHECKOUT_STEPS.indexOf(state.step) + 1];
  if (!nextStep) throw new POSDomainError('INVALID_CHECKOUT_TRANSITION', 'No existe un siguiente paso de checkout.');
  return transitionCheckout(state, nextStep, draft, hasReceipt);
}

export function transitionCheckout(
  state: CheckoutState,
  target: CheckoutStep,
  draft?: SaleDraft,
  hasReceipt = false,
): CheckoutState {
  if (state.step === 'confirmation' || state.step === 'processing') {
    throw new POSDomainError('INVALID_CHECKOUT_TRANSITION', 'El checkout ya está procesando o finalizado.');
  }
  const currentIndex = CHECKOUT_STEPS.indexOf(state.step);
  const targetIndex = CHECKOUT_STEPS.indexOf(target);
  if (targetIndex !== currentIndex + 1) {
    throw new POSDomainError('INVALID_CHECKOUT_TRANSITION', 'La transición de checkout no está permitida.');
  }
  validateCheckoutStep(state.step, draft, hasReceipt);
  return { ...state, step: target };
}

export function retreatCheckout(state: CheckoutState): CheckoutState {
  if (state.step === 'processing' || state.step === 'confirmation') {
    throw new POSDomainError('INVALID_CHECKOUT_TRANSITION', 'La venta ya fue enviada y no puede volver al carrito.');
  }
  const currentIndex = CHECKOUT_STEPS.indexOf(state.step);
  if (currentIndex <= 0) return state;
  return { ...state, step: CHECKOUT_STEPS[currentIndex - 1] };
}

export function checkoutStateFromSaleResult(
  result: Pick<CheckoutState, 'saleId' | 'paymentId' | 'conflictCode' | 'conflictMessage'> & { status: 'pending' | 'confirmed' | 'rejected' | 'conflict' | 'recovering' },
): CheckoutState {
  return {
    step: 'confirmation',
    saleStatus: result.status,
    saleId: result.saleId,
    paymentId: result.paymentId,
    conflictCode: result.conflictCode,
    conflictMessage: result.conflictMessage,
  };
}
