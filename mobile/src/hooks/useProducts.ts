import { useState, useEffect, useCallback } from 'react';
import { getProductsLocal, createProductLocal, CreateProductInput } from '../database/products';

export function useProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProductsLocal();
      setProducts(data);
    } catch (error) {
      console.error('Error al cargar productos desde SQLite:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const addProduct = async (input: CreateProductInput) => {
    const id = await createProductLocal(input);
    await refreshProducts();
    return id;
  };

  return {
    products,
    loading,
    refreshProducts,
    addProduct,
  };
}