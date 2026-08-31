import { useState, useEffect, useCallback } from 'react';
import { createSaleLocal, CreateSaleInput } from '../database/sales';
import { listSales } from '../repositories/salesRepository';
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

  const addSale = async (input: CreateSaleInput) => {
    const id = await createSaleLocal(input);
    await refreshSales();
    return id;
  };

  return {
    sales,
    loading,
    refreshSales,
    addSale,
  };
}
