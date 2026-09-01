import { hasTransferInstructions as hasConfiguredTransferInstructions } from './transferContract';
import type { TransferInstructions } from './transferContract';

export type { TransferInstructions, TransferInstructionField } from './transferContract';

const instructions: TransferInstructions = {
  bankName: process.env.EXPO_PUBLIC_TRANSFER_BANK_NAME?.trim() ?? '',
  accountType: process.env.EXPO_PUBLIC_TRANSFER_ACCOUNT_TYPE?.trim() ?? '',
  accountNumber: process.env.EXPO_PUBLIC_TRANSFER_ACCOUNT_NUMBER?.trim() ?? '',
  accountHolder: process.env.EXPO_PUBLIC_TRANSFER_ACCOUNT_HOLDER?.trim() ?? '',
  rut: process.env.EXPO_PUBLIC_TRANSFER_RUT?.trim() ?? '',
  email: process.env.EXPO_PUBLIC_TRANSFER_EMAIL?.trim() ?? '',
};

export const transferInstructions = Object.freeze(instructions);

export function hasTransferInstructions(value: TransferInstructions = transferInstructions): boolean {
  return hasConfiguredTransferInstructions(value);
}
