export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
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
  processed_at: string | null;
}