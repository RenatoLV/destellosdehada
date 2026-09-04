import { requireSupabaseConfiguration, supabase } from '@/services/supabase';

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const CATALOG_CACHE_PREFIX = 'destellos_public_catalog_v4:';
const memoryCache = new Map<string, { products: Product[]; cachedAt: number }>();
const pendingRequests = new Map<string, Promise<Product[]>>();

export type ProductAvailability = 'disponible' | 'ultimas_unidades' | 'agotado';

export type Product = {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  material: string;
  category: string;
  categoryId: string | null;
  price: number;
  stock: number;
  imageUrl: string;
  description?: string;
  availability: ProductAvailability;
  featured?: boolean;
  compareAtPrice?: number;
};

type ProductImageRow = {
  local_uri: string | null;
  storage_path: string | null;
  is_primary: number;
  sort_order: number;
};

type RemoteProduct = {
  id: string;
  organization_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  type: string | null;
  created_at: string;
  category_id: string | null;
  price: number;
  stock: number;
  categories: { name: string } | { name: string }[] | null;
  product_images: ProductImageRow[] | null;
};

type PublicCatalogResponse = {
  success: boolean;
  products?: RemoteProduct[];
  code?: string;
};

type CatalogCache = {
  products: Product[];
  cachedAt: number;
};

function cacheKey(organizationId: string) {
  return `${CATALOG_CACHE_PREFIX}${organizationId}`;
}

export function readCatalogCache(organizationId: string): Product[] | null {
  const memory = memoryCache.get(organizationId);
  if (memory) return memory.products;
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(organizationId)) ?? 'null') as CatalogCache | null;
    if (!parsed || !Array.isArray(parsed.products) || typeof parsed.cachedAt !== 'number') return null;
    memoryCache.set(organizationId, parsed);
    return parsed.products;
  } catch {
    return null;
  }
}

function cacheIsFresh(organizationId: string) {
  const cached = memoryCache.get(organizationId);
  return Boolean(cached && Date.now() - cached.cachedAt < CATALOG_CACHE_TTL_MS);
}

function writeCatalogCache(organizationId: string, products: Product[]) {
  const value: CatalogCache = { products, cachedAt: Date.now() };
  memoryCache.set(organizationId, value);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(cacheKey(organizationId), JSON.stringify(value));
  }
}

function relationName(value: RemoteProduct['categories']): string {
  if (Array.isArray(value)) return value[0]?.name ?? 'General';
  return value?.name ?? 'General';
}

function imageUrl(images: ProductImageRow[] | null): string {
  const ordered = [...(images ?? [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return b.is_primary - a.is_primary;
    return a.sort_order - b.sort_order;
  });
  const image = ordered.find((item) =>
    item.local_uri?.startsWith('http') || item.storage_path?.startsWith('http'));
  // Product images uploaded by the inventory app keep the Drive file id in
  // storage_path. Older rows may still have a local_uri from the device, so
  // use the durable remote id as a fallback for the public catalog.
  const source = image?.local_uri?.startsWith('http')
    ? image.local_uri
    : image?.storage_path?.startsWith('http')
      ? image.storage_path
      : image?.storage_path
        ? `https://lh3.googleusercontent.com/d/${image.storage_path}=w1200`
        : '';
  if (source.startsWith('https://lh3.googleusercontent.com/d/') && !source.includes('=')) {
    return `${source}=w1200`;
  }
  return source;
}

export async function loadCatalog(organizationId: string, force = false): Promise<Product[]> {
  requireSupabaseConfiguration();
  const cached = readCatalogCache(organizationId);
  if (!force && cached && cacheIsFresh(organizationId)) return cached;
  const existingRequest = pendingRequests.get(organizationId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke<PublicCatalogResponse>('public-catalog', {
      body: { organization_id: organizationId },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.code ?? 'No fue posible cargar el catálogo público.');
    const products = (data.products ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      sku: row.sku ?? row.id,
      name: row.name,
      material: row.type ?? 'Colección Destellos de Hada',
      category: relationName(row.categories),
      categoryId: row.category_id,
      price: Math.max(0, Math.trunc(row.price ?? 0)),
      stock: Math.max(0, Math.trunc(row.stock ?? 0)),
      imageUrl: imageUrl(row.product_images),
      description: row.description ?? undefined,
      featured: Date.now() - new Date(row.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
      availability: row.stock <= 0 ? 'agotado' : row.stock <= 2 ? 'ultimas_unidades' : 'disponible',
    } satisfies Product));
    writeCatalogCache(organizationId, products);
    return products;
  })();
  pendingRequests.set(organizationId, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(organizationId);
  }
}
