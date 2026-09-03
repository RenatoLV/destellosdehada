/**
 * utils/formatCurrency.ts
 * Utilidades de formato monetario en pesos chilenos y validación para Destellos de Hada.
 */
export function formatCLP(amount: number): string {
  return `$${amount.toLocaleString('es-CL')}`;
}

export const formatCurrencyCLP = formatCLP;

export function validateChileanPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s+-]/g, '');
  return cleaned.length >= 8 && cleaned.length <= 12;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
