import { getSalesLocal } from '../database/sales';
import { SaleSummary } from '../types/database';

export async function listSales(): Promise<SaleSummary[]> {
  return getSalesLocal();
}
