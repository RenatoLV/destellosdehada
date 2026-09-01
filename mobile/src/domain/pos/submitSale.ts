import { getActiveOrganizationContext } from '../../services/organizationContext';
import { createSaleLocal, getSaleLocal } from '../../database/sales';
import { createReceiptLocal } from '../../database/receipts';
import { POSDomainError } from './errors';
import { calculateCartTotals } from './money';
import {
  CheckoutSubmission,
  CreatePOSSaleInput,
  POSSaleSubmission,
  ReceiptSelection,
  SaleDraft,
  SaleResult,
} from './types';
import { validateCart } from './cart';

export function createSaleDraft(
  organizationId: string,
  input: CreatePOSSaleInput,
): SaleDraft {
  if (!organizationId || organizationId.startsWith('local:')) {
    throw new POSDomainError('NO_ACTIVE_ORGANIZATION', 'Se necesita una organización real para registrar la venta.');
  }
  validateCart(input.cart);
  const discount = input.discount ?? { type: 'fixed', amount: 0 };
  const totals = calculateCartTotals(input.cart, discount);
  return {
    organizationId,
    clientId: input.client?.id ?? null,
    clientName: input.client?.name ?? null,
    items: [...input.cart],
    discount,
    subtotal: totals.subtotal,
    total: totals.total,
    notes: input.notes?.trim() || null,
  };
}

export async function submitSaleDraft(draft: SaleDraft): Promise<POSSaleSubmission> {
  const context = await getActiveOrganizationContext();
  if (draft.organizationId !== context.organizationId) {
    throw new POSDomainError('ORGANIZATION_CONTEXT_MISMATCH', 'La venta no pertenece a la organización activa.');
  }
  if (context.organizationId.startsWith('local:')) {
    throw new POSDomainError('NO_ACTIVE_ORGANIZATION', 'La organización local aún no puede sincronizar ventas.');
  }
  const saleId = await createSaleLocal({
    items: draft.items.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    discount: draft.discount.amount,
    notes: draft.notes ?? undefined,
    clientId: draft.clientId,
    clientName: draft.clientName,
  });
  return { saleId, paymentId: null, status: 'pending' };
}

export async function submitPOSSale(input: CreatePOSSaleInput): Promise<POSSaleSubmission> {
  const context = await getActiveOrganizationContext();
  const draft = createSaleDraft(context.organizationId, input);
  return submitSaleDraft(draft);
}

export async function submitCheckout(
  draft: SaleDraft,
  receipt: ReceiptSelection,
): Promise<CheckoutSubmission> {
  const sale = await submitSaleDraft(draft);
  try {
    const receiptId = await createReceiptLocal({
      saleId: sale.saleId,
      localUri: receipt.localUri,
      mimeType: receipt.mimeType,
      fileSize: receipt.fileSize,
      checksum: receipt.checksum,
    });
    return { ...sale, receiptId };
  } catch (error: unknown) {
    // The sale is already safely persisted. Returning it prevents the UI from
    // creating a second sale if local receipt persistence fails afterwards.
    return {
      ...sale,
      receiptId: null,
      receiptError: error instanceof Error ? error.message : 'No se pudo guardar el comprobante local.',
    };
  }
}

export async function getPOSSaleResult(saleId: string): Promise<SaleResult | null> {
  const sale = await getSaleLocal(saleId);
  if (!sale) return null;
  const status = sale.status === 'pending' && sale.recovery_state === 'recovering'
    ? 'recovering'
    : sale.status;
  return {
    saleId: sale.id,
    paymentId: sale.payment_id ?? null,
    status,
    conflictCode: sale.conflict_code ?? null,
    conflictMessage: sale.conflict_message ?? sale.sync_error ?? null,
  };
}
