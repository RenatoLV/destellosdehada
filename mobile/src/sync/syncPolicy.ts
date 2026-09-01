export interface SyncErrorDetails {
  code?: string;
  status?: number;
  message: string;
  retryable?: boolean;
  conflict?: boolean;
}

export type SaleFailureDisposition = 'recover' | 'release' | 'retain';

export interface SyncFailurePolicy {
  queueStatus: 'failed' | 'blocked';
  retryable: boolean;
  saleDisposition: SaleFailureDisposition;
}

const PERMANENT_CODES = new Set([
  'INVALID_PAYLOAD',
  'PRICE_CHANGED',
  'STOCK_INSUFFICIENT',
  'PRODUCT_NOT_FOUND',
  'PRODUCT_INACTIVE',
  'CLIENT_NOT_FOUND',
  'NOT_ORGANIZATION_MEMBER',
  'IDEMPOTENCY_PAYLOAD_MISMATCH',
]);

export function getSyncErrorDetails(error: unknown): SyncErrorDetails {
  if (error && typeof error === 'object') {
    const candidate = error as {
      code?: unknown;
      status?: unknown;
      message?: unknown;
      retryable?: unknown;
      conflict?: unknown;
    };
    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : String(error),
      retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : undefined,
      conflict: typeof candidate.conflict === 'boolean' ? candidate.conflict : undefined,
    };
  }
  return { message: String(error || 'Error de sincronización.') };
}

export function isSyncFailureRetryable(error: unknown): boolean {
  const details = getSyncErrorDetails(error);
  if (details.retryable !== undefined) return details.retryable;
  if (details.status && details.status >= 400 && details.status < 500
    && details.status !== 408 && details.status !== 429) return false;
  return !['23505', '42501', '22023', 'P0001', 'P0002', 'STOCK_CONFLICT']
    .includes(details.code || '');
}

export function isStockConflict(error: unknown): boolean {
  const details = getSyncErrorDetails(error);
  const text = `${details.code || ''} ${details.message}`.toLowerCase();
  return details.conflict === true || details.code === 'STOCK_INSUFFICIENT'
    || details.code === 'PRICE_CHANGED' || text.includes('stock_conflict')
    || text.includes('stock insuficiente') || text.includes('insufficient stock');
}

export function isTransportUncertainty(error: unknown): boolean {
  const details = getSyncErrorDetails(error);
  if (details.retryable === false || PERMANENT_CODES.has(details.code || '')) return false;
  if (details.status && details.status >= 400 && details.status < 500
    && details.status !== 408 && details.status !== 429) return false;
  return details.retryable === true || !details.status || details.status >= 500
    || details.status === 408 || details.status === 429;
}

export function classifySyncFailure(
  error: unknown,
  attempts: number,
  maxAttempts: number,
): SyncFailurePolicy {
  const retryable = isSyncFailureRetryable(error);
  const uncertain = isTransportUncertainty(error);
  return {
    queueStatus: !retryable || attempts >= maxAttempts ? 'blocked' : 'failed',
    retryable,
    // A permanent business result must release the local reservation even if
    // it arrives on the final attempt. A transport uncertainty never does.
    saleDisposition: uncertain ? 'recover' : retryable ? 'retain' : 'release',
  };
}
