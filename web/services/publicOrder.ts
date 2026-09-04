import type { CartLine } from '@/context/CartContext';
import type { CustomerData, ReceiptData, Sale } from '@/services/saleStorage';
import { requireSupabaseConfiguration, supabase } from '@/services/supabase';

type PublicOrderInput = {
  id: string;
  reference: string;
  organizationId: string;
  userId: string;
  lines: CartLine[];
  subtotal: number;
  discountAmount: number;
  total: number;
  customer: CustomerData;
  receipt: ReceiptData;
};

function uuid() { return globalThis.crypto.randomUUID(); }

async function digest(value: string | Blob) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : await value.arrayBuffer();
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

export async function submitPublicOrder(input: PublicOrderInput): Promise<Sale> {
  requireSupabaseConfiguration();
  const receiptBlob = input.receipt.file ?? (input.receipt.previewUri ? await (await fetch(input.receipt.previewUri)).blob() : null);
  if (!receiptBlob) throw new Error('No fue posible leer el comprobante seleccionado.');

  const itemIds = Object.fromEntries(input.lines.map((line) => [line.product.id, uuid()]));
  const idempotencyKey = uuid();
  const order = {
    id: input.id,
    organization_id: input.organizationId,
    discount: Math.trunc(input.discountAmount),
    total: Math.trunc(input.total),
    notes: JSON.stringify({ customer: input.customer }),
    customer: input.customer,
    created_at: new Date().toISOString(),
    items: input.lines.map((line) => ({
      id: itemIds[line.product.id], product_id: line.product.id,
      quantity: line.quantity, unit_price: line.product.price,
    })),
  };
  const payloadHash = await digest(JSON.stringify(order));
  const { data, error } = await supabase.rpc('create_public_order', {
    p_organization_id: input.organizationId,
    p_order: order,
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash,
  });
  if (error) throw error;
  const created = data as { success?: boolean; sale_id?: string; payment_id?: string; status?: Sale['status']; total?: number; code?: string } | null;
  if (!created?.success || !created.sale_id || !created.payment_id) throw new Error(created?.code ?? 'No fue posible registrar el pedido web.');

  const receiptId = uuid();
  const checksum = await digest(receiptBlob);
  const { data: reservationData, error: reservationError } = await supabase.rpc('reserve_receipt', {
    p_organization_id: input.organizationId, p_sale_id: created.sale_id, p_payment_id: created.payment_id,
    p_receipt_id: receiptId, p_mime_type: input.receipt.fileType, p_file_size: receiptBlob.size, p_checksum: checksum,
  });
  if (reservationError) throw reservationError;
  const reservation = reservationData as { success?: boolean; storage_path?: string; code?: string } | null;
  if (!reservation?.success || !reservation.storage_path) throw new Error(reservation?.code ?? 'No fue posible reservar el comprobante.');

  const bucket = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || 'sale-receipts';
  const { error: uploadError } = await supabase.storage.from(bucket).upload(reservation.storage_path, receiptBlob, {
    contentType: input.receipt.fileType, upsert: false,
  });
  if (uploadError && !/duplicate|already exists|409/i.test(uploadError.message)) throw uploadError;
  const { data: attachedData, error: attachError } = await supabase.rpc('attach_receipt', {
    p_organization_id: input.organizationId, p_sale_id: created.sale_id, p_payment_id: created.payment_id,
    p_receipt_id: receiptId, p_storage_path: reservation.storage_path, p_mime_type: input.receipt.fileType,
    p_file_size: receiptBlob.size, p_checksum: checksum,
  });
  if (attachError) throw attachError;
  const attached = attachedData as { success?: boolean; code?: string } | null;
  if (!attached?.success) throw new Error(attached?.code ?? 'No fue posible asociar el comprobante.');

  return {
    id: created.sale_id, reference: input.reference, organizationId: input.organizationId,
    idempotencyKey, payloadHash, paymentId: created.payment_id, createdAt: order.created_at,
    saleItemIds: itemIds, items: input.lines, subtotal: input.subtotal,
    discount: { type: 'amount', value: input.discountAmount }, discountAmount: input.discountAmount,
    total: created.total ?? input.total, customer: input.customer,
    receipt: { ...input.receipt, receiptId, storagePath: reservation.storage_path, checksum, status: 'uploaded' },
    status: 'pending', synced: true, syncAttempts: 1, userId: input.userId,
  };
}
