import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loadCatalog, type Product } from '@/services/catalog';

export function useCatalog() {
  const { organization } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organization) {
      setProducts([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProducts(await loadCatalog(organization.id));
    } catch (cause) {
      setProducts([]);
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { products, loading, error, refresh };
}
