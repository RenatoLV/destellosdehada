import { useState, useEffect, useCallback } from 'react';
import { getSalesLocal, createSaleLocal, CreateSaleInput } from '../database/sales';

export function useSales() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSalesLocal();
      setSales(data);
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