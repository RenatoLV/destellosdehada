export interface Category {
  id: string;
  organization_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  owner_id?: string | null;
}

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  type: string | null;
  price: number;
  cost: number;
  stock: number;
  remote_stock?: number | null;
  pending_stock_delta?: number;
  stock_version?: number;
  sku: string | null;
  supplier: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Local SQLite projection; this field is not persisted by the remote products table. */
  image_uri?: string | null;
  owner_id?: string | null;
}

export interface ProductImage {
  id: string;
  organization_id: string;
  product_id: string;
  local_uri: string | null;
  storage_path: string | null;
  is_primary: number;
  sort_order: number;
  created_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rut: string | null;
  notes: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InventoryMovement {
  id: string;
  organization_id: string;
  product_id: string;
  type: 'INITIAL_STOCK' | 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number;
  reason: string | null;
  stock_before: number;
  stock_after: number;
  created_at: string;
}

export interface Sale {
  id: string;
  organization_id: string;
  created_by: string;
  discount: number;
  total: number;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  payment_id?: string | null;
  local_payment_id?: string | null;
  owner_id?: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'conflict';
  sync_error?: string | null;
  confirmed_at?: string | null;
  rejected_at?: string | null;
  conflict_code?: string | null;
  conflict_message?: string | null;
  idempotency_key: string;
  payload_hash?: string | null;
  server_payload_hash?: string | null;
  recovery_state?: 'none' | 'recovering';
  recovery_attempts?: number;
  last_recovery_at?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  organization_id: string;
  sale_id: string;
  remote_id: string | null;
  method: 'transfer';
  status: 'pending' | 'confirmed' | 'rejected';
  amount: number;
  reference: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface SaleItem {
  id: string;
  organization_id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SaleSummary extends Sale {
  first_product_name: string | null;
  total_items: number;
  sync_status: SyncQueueItem['status'] | null;
}

export interface Receipt {
  id: string;
  organization_id: string;
  sale_id: string;
  payment_id: string | null;
  local_payment_id: string | null;
  local_uri: string;
  storage_path: string | null;
  mime_type: string;
  file_size: number | null;
  checksum: string | null;
  upload_status: ReceiptStatus;
  last_error: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export type ReceiptMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
export type ReceiptStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';
export type ReceiptUploadStatus = ReceiptStatus;

export interface AttachReceiptResult {
  success: boolean;
  idempotent?: boolean;
  receipt_id: string | null;
  sale_id: string | null;
  payment_id: string | null;
  status?: 'uploaded';
  code?: string;
  message?: string;
}

export interface SaleTransactionPayload {
  id: string;
  organization_id: string;
  created_by: string;
  discount: number;
  total: number;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  idempotency_key: string;
  payload_hash?: string;
  items: SaleItem[];
}

/** The RPC input is the same immutable command persisted in sync_queue. */
export type ProcessSaleInput = SaleTransactionPayload;

export interface ProcessSaleResult {
  success: boolean;
  idempotent?: boolean;
  sale_id: string | null;
  payment_id?: string | null;
  status?: 'confirmed' | 'rejected' | 'conflict';
  code?: string;
  message?: string;
  total?: number;
  server_payload_hash?: string | null;
}

export interface RecoverySaleResult {
  found: boolean;
  sale_id?: string | null;
  organization_id?: string | null;
  status?: 'confirmed' | 'rejected' | 'conflict';
  total?: number;
  payment_id?: string | null;
  server_payload_hash?: string | null;
  confirmed_at?: string | null;
  rejected_at?: string | null;
  conflict_code?: string | null;
  conflict_message?: string | null;
  code?: string;
}

export interface ReserveReceiptResult {
  success: boolean;
  idempotent?: boolean;
  receipt_id: string | null;
  storage_path?: string | null;
  status?: ReceiptStatus;
  code?: string;
  message?: string;
}

export type SyncEntity = 'clients' | 'sale_transactions' | 'receipt_upload' | 'receipt_attach' | 'products' | 'categories' | 'inventory_movements' | 'product_images';

export type SyncStatus = 'pending' | 'processing' | 'synced' | 'failed' | 'blocked';

export interface SyncQueueItem {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  entity: string;
  entity_id: string;
  payload: string;
  idempotency_key: string | null;
  depends_on: string | null;
  created_at: string;
  status: SyncStatus;
  attempts: number;
  last_error: string | null;
  processed_at?: string | null;
  retry_at?: string | null;
  next_attempt_at?: string | null;
  processing_started_at?: string | null;
  updated_at?: string | null;
}
