import { getProductsLocal } from '../database/products';
import { Product } from '../types/database';

export type CatalogProduct = Product;

export async function listCatalogProducts(): Promise<CatalogProduct[]> {
  return getProductsLocal();
}
