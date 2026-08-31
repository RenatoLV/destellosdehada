import { useState, useEffect, useCallback } from 'react';
import { getProductsLocal, createProductLocal, CreateProductInput } from '../database/products';
import { Product } from '../types/database';

/** Admin-only hook. Sales screens must use useProducts instead. */
export function useAdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProducts = useCallback(async () => {
    try {
      setLoading(true);
      setProducts(await getProductsLocal());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshProducts(); }, [refreshProducts]);

  const addProduct = async (input: CreateProductInput) => {
    const id = await createProductLocal(input);
    await refreshProducts();
    return id;
  };

  return { products, loading, refreshProducts, addProduct };
}
