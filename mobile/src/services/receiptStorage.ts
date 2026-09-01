import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import type { ReceiptMimeType } from '../types/database';
import {
  MAX_RECEIPT_BYTES,
  buildReceiptStoragePath,
  isReceiptMimeType,
} from './receiptContract';

export {
  MAX_RECEIPT_BYTES,
  RECEIPT_MIME_TYPES,
  buildReceiptStoragePath,
  getReceiptExtension,
  isReceiptMimeType,
} from './receiptContract';

export interface LocalReceiptFileInfo {
  size: number;
  checksum: string | null;
}

export async function inspectLocalReceiptFile(localUri: string): Promise<LocalReceiptFileInfo> {
  if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
    throw new Error('El comprobante debe estar disponible como archivo local.');
  }
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.isDirectory) throw new Error('El archivo del comprobante no existe.');
  const size = typeof info.size === 'number' ? info.size : 0;
  if (size <= 0 || size > MAX_RECEIPT_BYTES) {
    throw new Error('El comprobante debe pesar entre 1 byte y 10 MB.');
  }
  const contents = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, contents);
  return { size, checksum };
}

export async function uploadReceiptToStorage(
  localUri: string,
  storagePath: string,
  mimeType: ReceiptMimeType,
): Promise<void> {
  const fileResponse = await fetch(localUri);
  if (!fileResponse.ok) throw new Error('No fue posible leer el archivo local del comprobante.');
  const body = await fileResponse.arrayBuffer();
  const { error } = await supabase.storage.from('sale-receipts').upload(storagePath, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (!error) return;

  // A timeout can happen after Storage has committed the object. Treat a
  // duplicate object as success; attach_receipt remains the authoritative
  // association and is idempotent too.
  const message = `${error.message ?? ''}`.toLowerCase();
  if (error.statusCode === '409' || message.includes('already exists') || message.includes('duplicate')) return;
  throw error;
}

export async function createReceiptSignedUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
  if (!storagePath || storagePath.includes('://')) throw new Error('La ruta del comprobante no es válida.');
  const { data, error } = await supabase.storage
    .from('sale-receipts')
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error('No fue posible generar el acceso temporal.');
  return data.signedUrl;
}
