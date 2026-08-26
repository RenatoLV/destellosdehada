import { useState, useEffect, useCallback } from 'react';
import { getCategoriesLocal, addCategoryLocal } from '../database/categories';
import { Category } from '../types/database';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCategoriesLocal();
      setCategories(data);
    } catch (error) {
      console.error('Error al cargar categorías desde SQLite:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  const addCategory = async (name: string, parentId?: string) => {
    const id = await addCategoryLocal(name, parentId || null);
    await refreshCategories();
    return id;
  };

  return {
    categories,
    loading,
    refreshCategories,
    addCategory,
  };
}