export type POSDomainErrorCode =
  | 'EMPTY_CART'
  | 'INVALID_QUANTITY'
  | 'INVALID_DISCOUNT'
  | 'INVALID_TOTAL'
  | 'NO_ACTIVE_ORGANIZATION'
  | 'ORGANIZATION_CONTEXT_MISMATCH'
  | 'PRODUCT_UNAVAILABLE'
  | 'PRODUCT_STOCK_LIMIT'
  | 'INVALID_CHECKOUT_TRANSITION';

export class POSDomainError extends Error {
  readonly code: POSDomainErrorCode;

  constructor(code: POSDomainErrorCode, message: string) {
    super(message);
    this.name = 'POSDomainError';
    this.code = code;
  }
}

export function getPOSDomainErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No fue posible completar la operación.';
}
