import { useState, useEffect, useCallback } from 'react';
import { CreatePOSSaleInput, submitPOSSale } from '../domain/pos';
import { approvePublicSale, listSales } from '../repositories/salesRepository';
import { SaleSummary } from '../types/database';

export function useSales() {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSales = useCallback(async () => {
    try {
      setLoading(true);
      setSales(await listSales());
    } catch (error) {
      console.error('Error al cargar ventas desde SQLite:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSales();
  }, [refreshSales]);

  const addSale = async (input: CreatePOSSaleInput) => {
    const { saleId: id } = await submitPOSSale(input);
    await refreshSales();
    return id;
  };

  const approveWebSale = async (saleId: string) => {
    await approvePublicSale(saleId);
    await refreshSales();
  };

  return {
    sales,
    loading,
    refreshSales,
    addSale,
    approveWebSale,
  };
}
