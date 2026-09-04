import { useState, useEffect, useCallback } from 'react';
import { listCatalogProducts, CatalogProduct } from '../repositories/catalogRepository';

export function useProducts() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProducts = useCallback(async () => {
    try {
      setLoading(true);
      setProducts(await listCatalogProducts());
    } catch (error) {
      if (error instanceof Error && error.message === 'No existe una sesión autenticada.') {
        setProducts([]);
        return;
      }
      console.error('Error al cargar productos desde SQLite:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  return {
    products,
    loading,
    refreshProducts,
  };
}
