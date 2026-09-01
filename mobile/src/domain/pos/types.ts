import type { Client, Product } from '../../types/database';

export type DiscountType = 'fixed';

export interface Discount {
  type: DiscountType;
  amount: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  /** Stock proyectado calculado por la capa local de datos. */
  availableStock: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  total: number;
  totalItems: number;
}

export interface SaleDraft {
  organizationId: string;
  clientId: string | null;
  clientName: string | null;
  items: CartItem[];
  discount: Discount;
  subtotal: number;
  total: number;
  notes: string | null;
}

export type CheckoutStep =
  | 'cart'
  | 'client'
  | 'transfer'
  | 'receipt'
  | 'processing'
  | 'confirmation';

export type SaleResultStatus = 'pending' | 'confirmed' | 'rejected' | 'conflict' | 'recovering';

export interface SaleResult {
  saleId: string | null;
  paymentId: string | null;
  status: SaleResultStatus;
  conflictCode?: string | null;
  conflictMessage?: string | null;
}

export interface CheckoutState {
  step: CheckoutStep;
  saleStatus?: SaleResultStatus;
  saleId?: string | null;
  paymentId?: string | null;
  conflictCode?: string | null;
  conflictMessage?: string | null;
}

export interface POSSession {
  organizationId: string;
  userId: string;
  cart: CartItem[];
  client: Client | null;
  discount: Discount;
  notes: string;
  checkout: CheckoutState;
}

export interface POSSaleSubmission extends SaleResult {
  saleId: string;
  status: 'pending';
}

export interface CheckoutSubmission extends POSSaleSubmission {
  receiptId: string | null;
  receiptError?: string | null;
}

export interface CreatePOSSaleInput {
  cart: CartItem[];
  discount?: Discount;
  client?: Client | null;
  notes?: string | null;
}

export interface ReceiptSelection {
  localUri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  fileName?: string | null;
  fileSize?: number;
  checksum?: string | null;
}
