import type { ReceiptMimeType } from '../types/database';

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MIME_TYPES: readonly ReceiptMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const EXTENSIONS: Record<ReceiptMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function getReceiptExtension(mimeType: ReceiptMimeType): string {
  return EXTENSIONS[mimeType];
}

export function isReceiptMimeType(value: string): value is ReceiptMimeType {
  return (RECEIPT_MIME_TYPES as readonly string[]).includes(value);
}

export function buildReceiptStoragePath(
  organizationId: string,
  saleId: string,
  receiptId: string,
  mimeType: ReceiptMimeType,
): string {
  if ([organizationId, saleId, receiptId].some(value => !value || value.includes('/'))) {
    throw new Error('El contexto del comprobante no es válido.');
  }
  return `${organizationId}/${saleId}/${receiptId}.${getReceiptExtension(mimeType)}`;
}
