import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loadCatalog, readCatalogCache, type Product } from '@/services/catalog';

const PUBLIC_ORGANIZATION_ID = process.env.EXPO_PUBLIC_CATALOG_ORGANIZATION_ID?.trim() ?? '';

export function useCatalog() {
  const { organization, initializing } = useAuth();
  const initialOrganizationId = organization?.id ?? PUBLIC_ORGANIZATION_ID;
  const [products, setProducts] = useState<Product[]>(() =>
    initialOrganizationId ? readCatalogCache(initialOrganizationId) ?? [] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async (force: boolean) => {
    const catalogOrganizationId = organization?.id ?? PUBLIC_ORGANIZATION_ID;
    if (initializing && !PUBLIC_ORGANIZATION_ID) return;
    if (!catalogOrganizationId) {
      setProducts([]);
      setError('Configura EXPO_PUBLIC_CATALOG_ORGANIZATION_ID para publicar el catálogo.');
      return;
    }
    const cached = readCatalogCache(catalogOrganizationId);
    if (cached) setProducts(cached);
    setLoading(!cached);
    setError(null);
    try {
      setProducts(await loadCatalog(catalogOrganizationId, force));
    } catch (cause) {
      if (!cached) {
        setProducts([]);
        setError(cause instanceof Error ? cause.message : 'No fue posible cargar el catálogo.');
      }
    } finally {
      setLoading(false);
    }
  }, [initializing, organization]);

  const refresh = useCallback(() => fetchCatalog(true), [fetchCatalog]);

  useEffect(() => {
    void fetchCatalog(false);
  }, [fetchCatalog]);

  return {
    products,
    loading: loading || (initializing && !PUBLIC_ORGANIZATION_ID),
    error,
    refresh,
  };
}
