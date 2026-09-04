import type { CartLine, Discount } from '@/context/CartContext';
import type { Product } from '@/services/catalog';
import { deleteReceiptBlob, getReceiptBlob, saveReceiptBlob } from '@/services/receiptBlobStore';
import { requireSupabaseConfiguration, supabase } from '@/services/supabase';

export type SaleStatus = 'pending' | 'recovering' | 'confirmed' | 'rejected' | 'conflict';
export type ReceiptStatus = 'pending' | 'uploading' | 'uploaded' | 'attached' | 'failed';

export type CustomerData = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

export type ReceiptData = {
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  fileType: string;
  previewUri?: string;
  uploadedAt: string;
  file?: Blob;
  receiptId?: string;
  storagePath?: string;
  status?: ReceiptStatus;
  checksum?: string;
};

export type Sale = {
  id: string;
  reference: string;
  organizationId: string;
  idempotencyKey: string;
  payloadHash: string;
  serverPayloadHash?: string;
  paymentId?: string;
  createdAt: string;
  saleItemIds: Record<string, string>;
  items: CartLine[];
  subtotal: number;
  discount: Discount;
  discountAmount: number;
  total: number;
  customer: CustomerData;
  receipt?: ReceiptData;
  status: SaleStatus;
  synced: boolean;
  syncAttempts: number;
  userId: string;
  conflictCode?: string;
  conflictMessage?: string;
};

type ProcessSaleResult = {
  success: boolean;
  idempotent?: boolean;
  sale_id?: string | null;
  payment_id?: string | null;
  status?: SaleStatus;
  code?: string;
  message?: string;
  server_payload_hash?: string;
};

type RecoveryResult = ProcessSaleResult & {
  found: boolean;
  confirmed_at?: string | null;
};

type LocalSaleInput = {
  identity: { id: string; reference: string };
  organizationId: string;
  userId: string;
  lines: CartLine[];
  subtotal: number;
  discount: Discount;
  discountAmount: number;
  total: number;
  customer: CustomerData;
  receipt: ReceiptData;
};

const STORAGE_KEY = 'destellos_de_hada_sales_v2';
const PERMANENT_CONFLICTS = new Set(['PRICE_CHANGED', 'STOCK_INSUFFICIENT', 'PRODUCT_NOT_FOUND', 'PRODUCT_INACTIVE']);
const ALLOWED_RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function sha256(value: string | Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador no permite calcular una huella segura.');
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : await value.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

function serializableSale(sale: Sale): Sale {
  return {
    ...sale,
    receipt: sale.receipt ? { ...sale.receipt, file: undefined } : undefined,
  };
}

function parseCustomer(notes: unknown, clientName: unknown): CustomerData {
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes) as { customer?: Partial<CustomerData> };
      if (parsed.customer) {
        return {
          fullName: parsed.customer.fullName ?? String(clientName ?? ''),
          phone: parsed.customer.phone ?? '',
          email: parsed.customer.email ?? '',
          notes: parsed.customer.notes ?? '',
        };
      }
    } catch {
      // Historical notes remain readable as plain text.
    }
  }
  return { fullName: String(clientName ?? ''), phone: '', email: '', notes: typeof notes === 'string' ? notes : '' };
}

class SaleStorageService {
  private sales: Sale[] = [];
  private context: { userId: string; organizationId: string } | null = null;
  private activeSync: Promise<{ syncedCount: number; errors: number }> | null = null;

  constructor() {
    this.loadFromStorage();
  }

  setContext(userId: string, organizationId: string) {
    this.context = { userId, organizationId };
  }

  clearContext() {
    this.context = null;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      this.sales = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.sales = [];
    }
  }

  private persist() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sales.map(serializableSale)));
  }

  private updateSale(id: string, changes: Partial<Sale>): Sale {
    const index = this.sales.findIndex((sale) => sale.id === id);
    if (index < 0) throw new Error('La venta local no existe.');
    this.sales[index] = { ...this.sales[index], ...changes };
    this.persist();
    return this.sales[index];
  }

  getAllSales(): Sale[] {
    if (!this.context) return [];
    return this.sales
      .filter((sale) => sale.organizationId === this.context?.organizationId && sale.userId === this.context?.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingSales(): Sale[] {
    return this.getAllSales().filter((sale) =>
      !sale.synced
      || Boolean(
        sale.status === 'confirmed'
        && sale.receipt
        && sale.receipt.status !== 'attached',
      ));
  }

  getSaleById(id: string): Sale | undefined {
    return this.getAllSales().find((sale) => sale.id === id || sale.reference === id);
  }

  generateSaleId(): { id: string; reference: string } {
    const id = uuid();
    return { id, reference: `VENTA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}` };
  }

  async createLocalSale(input: LocalSaleInput): Promise<Sale> {
    if (!this.context || this.context.organizationId !== input.organizationId || this.context.userId !== input.userId) {
      throw new Error('La venta no coincide con el usuario y organización activos.');
    }
    if (!input.lines.length) throw new Error('El carrito está vacío.');
    const { id, reference } = input.identity;
    const saleItemIds = Object.fromEntries(input.lines.map((line) => [line.product.id, uuid()]));
    const idempotencyKey = uuid();
    const canonicalClientPayload = {
      id,
      organization_id: input.organizationId,
      client_id: null,
      client_name: input.customer.fullName.trim() || null,
      discount: Math.max(0, Math.trunc(input.discountAmount)),
      total: Math.max(0, Math.trunc(input.total)),
      items: input.lines.map((line) => ({
        id: saleItemIds[line.product.id],
        product_id: line.product.id,
        quantity: line.quantity,
        unit_price: line.product.price,
      })),
    };
    const payloadHash = await sha256(JSON.stringify(canonicalClientPayload));
    const receiptId = uuid();
    const sale: Sale = {
      id,
      reference,
      organizationId: input.organizationId,
      idempotencyKey,
      payloadHash,
      createdAt: new Date().toISOString(),
      saleItemIds,
      items: input.lines.map((line) => ({ ...line, product: { ...line.product } })),
      subtotal: Math.trunc(input.subtotal),
      discount: input.discount,
      discountAmount: Math.trunc(input.discountAmount),
      total: Math.trunc(input.total),
      customer: { ...input.customer },
      receipt: { ...input.receipt, receiptId, status: 'pending' },
      status: 'pending',
      synced: false,
      syncAttempts: 0,
      userId: input.userId,
    };

    let receiptBlob = input.receipt.file;
    if (!receiptBlob && input.receipt.previewUri) {
      try {
        receiptBlob = await (await fetch(input.receipt.previewUri)).blob();
      } catch {
        receiptBlob = undefined;
      }
    }
    if (!receiptBlob) throw new Error('No fue posible conservar el comprobante para sincronizarlo.');
    await saveReceiptBlob(id, receiptBlob);
    this.sales.unshift(serializableSale(sale));
    this.persist();
    return sale;
  }

  private salePayload(sale: Sale) {
    return {
      id: sale.id,
      organization_id: sale.organizationId,
      created_by: sale.userId,
      client_id: null,
      client_name: sale.customer.fullName.trim() || null,
      discount: sale.discountAmount,
      total: sale.total,
      notes: JSON.stringify({ customer: sale.customer }),
      payment_reference: sale.reference,
      created_at: sale.createdAt,
      idempotency_key: sale.idempotencyKey,
      payload_hash: sale.payloadHash,
      items: sale.items.map((line) => ({
        id: sale.saleItemIds[line.product.id],
        product_id: line.product.id,
        quantity: line.quantity,
        unit_price: line.product.price,
      })),
    };
  }

  private applyBusinessFailure(sale: Sale, result: ProcessSaleResult) {
    const conflict = PERMANENT_CONFLICTS.has(result.code ?? '');
    this.updateSale(sale.id, {
      status: conflict ? 'conflict' : 'rejected',
      synced: true,
      conflictCode: result.code ?? 'SALE_REJECTED',
      conflictMessage: result.message ?? 'La venta fue rechazada por el servidor.',
    });
  }

  private async recoverSale(sale: Sale): Promise<boolean> {
    const { data, error } = await supabase.rpc('get_sale_by_idempotency_key', {
      p_organization_id: sale.organizationId,
      p_idempotency_key: sale.idempotencyKey,
    });
    if (error) throw error;
    const result = data as RecoveryResult | null;
    if (!result) throw new Error('La recuperación no devolvió un resultado.');
    if (!result.found && result.code === 'NOT_FOUND') return false;
    if (!result.found) throw new Error(result.code ?? 'No fue posible verificar la venta.');
    if (result.status === 'confirmed') {
      this.updateSale(sale.id, {
        status: 'confirmed',
        synced: true,
        paymentId: result.payment_id ?? undefined,
        serverPayloadHash: result.server_payload_hash,
        conflictCode: undefined,
        conflictMessage: undefined,
      });
      return true;
    }
    this.applyBusinessFailure(sale, result);
    return true;
  }

  private async processSale(sale: Sale): Promise<void> {
    if (sale.status === 'recovering') {
      const recovered = await this.recoverSale(sale);
      if (recovered) return;
      this.updateSale(sale.id, { status: 'pending' });
    }

    const { data, error } = await supabase.functions.invoke('process-sale', {
      body: this.salePayload(sale),
    });
    if (error) {
      this.updateSale(sale.id, { status: 'recovering', synced: false, syncAttempts: sale.syncAttempts + 1 });
      throw error;
    }
    const result = data as ProcessSaleResult | null;
    if (!result) {
      this.updateSale(sale.id, { status: 'recovering', synced: false, syncAttempts: sale.syncAttempts + 1 });
      throw new Error('El servidor no devolvió el estado de la venta.');
    }
    if (!result.success) {
      this.applyBusinessFailure(sale, result);
      return;
    }
    this.updateSale(sale.id, {
      status: 'confirmed',
      synced: true,
      syncAttempts: sale.syncAttempts + 1,
      paymentId: result.payment_id ?? undefined,
      serverPayloadHash: result.server_payload_hash,
      conflictCode: undefined,
      conflictMessage: undefined,
    });
  }

  private async syncReceipt(sale: Sale): Promise<void> {
    const current = this.getSaleById(sale.id);
    if (!current?.receipt || current.receipt.status === 'attached') return;
    if (current.status !== 'confirmed' || !current.paymentId || !current.receipt.receiptId) return;
    const blob = await getReceiptBlob(current.id);
    if (!blob) {
      this.updateSale(current.id, { receipt: { ...current.receipt, status: 'failed' } });
      throw new Error('El archivo local del comprobante ya no está disponible.');
    }
    if (!ALLOWED_RECEIPT_TYPES.has(current.receipt.fileType) || blob.size <= 0 || blob.size > 10 * 1024 * 1024) {
      this.updateSale(current.id, { receipt: { ...current.receipt, status: 'failed' } });
      throw new Error('El comprobante no cumple el tipo o tamaño permitido.');
    }
    const checksum = await sha256(blob);
    const { data: reservationData, error: reservationError } = await supabase.rpc('reserve_receipt', {
      p_organization_id: current.organizationId,
      p_sale_id: current.id,
      p_payment_id: current.paymentId,
      p_receipt_id: current.receipt.receiptId,
      p_mime_type: current.receipt.fileType,
      p_file_size: blob.size,
      p_checksum: checksum,
    });
    if (reservationError) throw reservationError;
    const reservation = reservationData as { success?: boolean; storage_path?: string; code?: string } | null;
    if (!reservation?.success || !reservation.storage_path) {
      throw new Error(reservation?.code ?? 'No fue posible reservar el comprobante.');
    }
    const receipt = { ...current.receipt, status: 'uploading' as const, storagePath: reservation.storage_path, checksum };
    this.updateSale(current.id, { receipt });

    const bucket = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || 'sale-receipts';
    const { error: uploadError } = await supabase.storage.from(bucket).upload(reservation.storage_path, blob, {
      contentType: current.receipt.fileType,
      upsert: false,
    });
    const duplicate = uploadError && /duplicate|already exists|409/i.test(uploadError.message);
    if (uploadError && !duplicate) throw uploadError;
    this.updateSale(current.id, { receipt: { ...receipt, status: 'uploaded' } });

    const { data: attachData, error: attachError } = await supabase.rpc('attach_receipt', {
      p_organization_id: current.organizationId,
      p_sale_id: current.id,
      p_payment_id: current.paymentId,
      p_receipt_id: current.receipt.receiptId,
      p_storage_path: reservation.storage_path,
      p_mime_type: current.receipt.fileType,
      p_file_size: blob.size,
      p_checksum: checksum,
    });
    if (attachError) throw attachError;
    const attached = attachData as { success?: boolean; code?: string } | null;
    if (!attached?.success) throw new Error(attached?.code ?? 'No fue posible asociar el comprobante.');
    this.updateSale(current.id, { receipt: { ...receipt, status: 'attached', uploadedAt: new Date().toISOString() } });
    await deleteReceiptBlob(current.id);
  }

  private async performSync(): Promise<{ syncedCount: number; errors: number }> {
    requireSupabaseConfiguration();
    if (!this.context) throw new Error('Inicia sesión y selecciona una organización para sincronizar.');
    let syncedCount = 0;
    let errors = 0;
    for (const initial of this.getPendingSales()) {
      if (initial.organizationId !== this.context.organizationId || initial.userId !== this.context.userId) continue;
      try {
        if (!initial.synced) await this.processSale(initial);
        const current = this.getSaleById(initial.id);
        if (current?.status === 'confirmed') {
          await this.syncReceipt(current);
          syncedCount += 1;
        } else if (current?.status === 'rejected' || current?.status === 'conflict') {
          errors += 1;
        }
      } catch (error) {
        console.warn(`No fue posible sincronizar la venta ${initial.id}`, error);
        errors += 1;
      }
    }
    return { syncedCount, errors };
  }

  async syncAllPending(): Promise<{ syncedCount: number; errors: number }> {
    if (this.activeSync) return this.activeSync;
    this.activeSync = this.performSync().finally(() => {
      this.activeSync = null;
    });
    return this.activeSync;
  }

  async loadRemoteSales(): Promise<Sale[]> {
    if (!this.context) return this.getAllSales();
    const organizationId = this.context.organizationId;
    const { data: remoteSales, error: salesError } = await supabase
      .from('sales')
      .select('id, organization_id, created_by, discount, total, notes, client_name, status, idempotency_key, payload_hash, server_payload_hash, confirmed_at, rejected_at, conflict_code, conflict_message, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (salesError) throw salesError;
    const ids = (remoteSales ?? []).map((row) => row.id);
    if (!ids.length) return this.getAllSales();

    const { data: remoteItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('id, sale_id, product_id, quantity, unit_price')
      .eq('organization_id', organizationId)
      .in('sale_id', ids);
    if (itemsError) throw itemsError;
    const productIds = [...new Set((remoteItems ?? []).map((item) => item.product_id))];
    const { data: remoteProducts, error: productError } = productIds.length
      ? await supabase.from('products').select('id, organization_id, sku, name, description, type, category_id, price, stock').in('id', productIds)
      : { data: [], error: null };
    if (productError) throw productError;
    const products = new Map((remoteProducts ?? []).map((row) => [row.id, row]));

    const mapped = (remoteSales ?? []).map((row): Sale => {
      const items: CartLine[] = (remoteItems ?? []).filter((item) => item.sale_id === row.id).map((item) => {
        const source = products.get(item.product_id);
        const product: Product = {
          id: item.product_id,
          organizationId,
          sku: source?.sku ?? item.product_id,
          name: source?.name ?? 'Producto',
          material: source?.type ?? 'Colección Destellos de Hada',
          category: 'General',
          categoryId: source?.category_id ?? null,
          price: item.unit_price,
          stock: source?.stock ?? 0,
          imageUrl: '',
          description: source?.description ?? undefined,
          availability: (source?.stock ?? 0) <= 0 ? 'agotado' : 'disponible',
        };
        return { product, quantity: item.quantity };
      });
      const customer = parseCustomer(row.notes, row.client_name);
      return {
        id: row.id,
        reference: `VENTA-${row.id.slice(0, 8).toUpperCase()}`,
        organizationId,
        idempotencyKey: row.idempotency_key ?? row.id,
        payloadHash: row.payload_hash ?? '',
        serverPayloadHash: row.server_payload_hash ?? undefined,
        createdAt: row.created_at,
        saleItemIds: Object.fromEntries((remoteItems ?? []).filter((item) => item.sale_id === row.id).map((item) => [item.product_id, item.id])),
        items,
        subtotal: row.total + row.discount,
        discount: row.discount ? { type: 'amount', value: row.discount } : null,
        discountAmount: row.discount,
        total: row.total,
        customer,
        status: row.status as SaleStatus,
        synced: true,
        syncAttempts: 0,
        userId: row.created_by ?? this.context?.userId ?? '',
        conflictCode: row.conflict_code ?? undefined,
        conflictMessage: row.conflict_message ?? undefined,
      };
    });

    const merged = new Map<string, Sale>();
    [...this.getAllSales(), ...mapped].forEach((sale) => merged.set(sale.id, sale));
    return [...merged.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const saleStorage = new SaleStorageService();

export const BANK_DETAILS = {
  bankName: process.env.EXPO_PUBLIC_TRANSFER_BANK_NAME?.trim() || 'Mercado Pago',
  accountHolder: process.env.EXPO_PUBLIC_TRANSFER_ACCOUNT_HOLDER?.trim() || 'Paola Dinamarca Avilés',
  rut: process.env.EXPO_PUBLIC_TRANSFER_RUT?.trim() || '13.762.023-5',
  accountType: process.env.EXPO_PUBLIC_TRANSFER_ACCOUNT_TYPE?.trim() || 'Cuenta Vista',
  accountNumber: process.env.EXPO_PUBLIC_TRANSFER_ACCOUNT_NUMBER?.trim() || '1041423953',
  email: process.env.EXPO_PUBLIC_TRANSFER_EMAIL?.trim() || 'dinamarcaviles24@gmail.com',
};
