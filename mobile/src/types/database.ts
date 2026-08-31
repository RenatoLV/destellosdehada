export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  owner_id?: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  type: string | null;
  price: number;
  cost: number;
  stock: number;
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
  product_id: string;
  local_uri: string | null;
  storage_path: string | null;
  is_primary: number;
  sort_order: number;
  created_at: string;
}

export interface Client {
  id: string;
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
  discount: number;
  total: number;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  owner_id?: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
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

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface Receipt {
  id: string;
  sale_id: string;
  storage_path: string;
  mime_type: string;
  created_at: string;
}

export interface SaleTransactionPayload {
  id: string;
  discount: number;
  total: number;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  items: SaleItem[];
}

export type SyncEntity = 'clients' | 'sale_transactions';

export interface SyncQueueItem {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  entity: string;
  entity_id: string;
  payload: string;
  created_at: string;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  attempts: number;
  last_error: string | null;
  processed_at?: string | null;
  retry_at?: string | null;
  updated_at?: string | null;
}
