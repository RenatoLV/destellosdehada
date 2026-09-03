import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
const PRODUCT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ProductImageUploadInput {
  imageId: string;
  organizationId: string;
  productId: string;
  localUri: string;
  mimeType: string;
  fileName: string;
  createdAt?: string;
}

export interface ProductImageUploadResult {
  success: boolean;
  idempotent?: boolean;
  image_id?: string;
  file_url?: string;
  file_id?: string;
  code?: string;
}

async function readWebImage(localUri: string): Promise<{ base64: string; size: number }> {
  const fileResponse = await fetch(localUri);
  if (!fileResponse.ok) throw new Error('No fue posible leer la imagen seleccionada.');
  const blob = await fileResponse.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return { base64: globalThis.btoa(binary), size: blob.size };
}

async function readLocalImage(localUri: string): Promise<{ base64: string; size: number }> {
  if (Platform.OS === 'web') return readWebImage(localUri);
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.isDirectory) throw new Error('La foto local ya no está disponible.');
  const size = typeof info.size === 'number' ? info.size : 0;
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, size };
}

export async function uploadProductImageToDrive(
  input: ProductImageUploadInput,
): Promise<ProductImageUploadResult> {
  if (!PRODUCT_IMAGE_MIME_TYPES.has(input.mimeType)) {
    throw new Error('La foto debe ser JPG, PNG o WebP.');
  }
  const file = await readLocalImage(input.localUri);
  if (file.size <= 0 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error('La foto debe pesar menos de 8 MB.');
  }
  const { data, error } = await supabase.functions.invoke('upload-product-image', {
    body: {
      image_id: input.imageId,
      organization_id: input.organizationId,
      product_id: input.productId,
      local_uri: input.localUri,
      mime_type: input.mimeType,
      file_name: input.fileName,
      created_at: input.createdAt,
      base64: file.base64,
    },
  });
  if (error) throw error;
  const result = data as ProductImageUploadResult | null;
  if (!result?.success || result.image_id !== input.imageId || !result.file_url) {
    throw new Error(result?.code || 'No fue posible subir la foto del producto.');
  }
  return result;
}
