import { requireSupabaseConfiguration, supabase } from '@/services/supabase';

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
  supplier: string | null;
  category_id: string | null;
  price: number;
  stock: number;
  categories: { name: string } | { name: string }[] | null;
  product_images: ProductImageRow[] | null;
};

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
  return image?.local_uri?.startsWith('http')
    ? image.local_uri
    : image?.storage_path ?? '';
}

export async function loadCatalog(organizationId: string): Promise<Product[]> {
  requireSupabaseConfiguration();
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, organization_id, sku, name, description, type, supplier,
      category_id, price, stock,
      categories(name),
      product_images(local_uri, storage_path, is_primary, sort_order)
    `)
    .eq('organization_id', organizationId)
    .eq('active', 1)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as RemoteProduct[]).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    sku: row.sku ?? row.id,
    name: row.name,
    material: row.type ?? row.supplier ?? 'Colección Destellos de Hada',
    category: relationName(row.categories),
    categoryId: row.category_id,
    price: Math.max(0, Math.trunc(row.price ?? 0)),
    stock: Math.max(0, Math.trunc(row.stock ?? 0)),
    imageUrl: imageUrl(row.product_images),
    description: row.description ?? undefined,
    availability: row.stock <= 0 ? 'agotado' : row.stock <= 2 ? 'ultimas_unidades' : 'disponible',
  }));
}
