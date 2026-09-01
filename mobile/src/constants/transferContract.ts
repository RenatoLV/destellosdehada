export interface TransferInstructions {
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  rut: string;
  email: string;
}

export type TransferInstructionField = keyof TransferInstructions;

export function hasTransferInstructions(value: TransferInstructions): boolean {
  return Object.values(value).every(field => field.length > 0);
}
