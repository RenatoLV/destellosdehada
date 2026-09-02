/**
 * components/sales/ProductGrid.tsx
 * Sección 63: mobile 2 columnas, desktop 2–4 según ancho.
 * Usa flex-wrap en vez de FlatList numColumns porque numColumns no se puede
 * cambiar dinámicamente sin remount — con ~20 ítems el costo es despreciable
 * (la virtualización real es tarea de Fase 14 / sección 79, Performance).
 */
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { ProductCard } from '@/components/sales/ProductCard';
import type { Product } from '@/data/mockProducts';
import { useTheme } from '@/theme';

type Props = {
  products: Product[];
  onAdd: (product: Product) => void;
  onQuickView?: (product: Product) => void;
};

export function ProductGrid({ products, onAdd, onQuickView }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const columns = width >= 1280 ? 4 : width >= 768 ? 3 : 2;

  return (
    <View style={styles.grid}>
      {products.map((product, index) => (
        <View key={product.id} style={{ width: `${100 / columns}%`, padding: theme.spacing.xxs }}>
          <ProductCard product={product} index={index} onAdd={onAdd} onQuickView={onQuickView} />
        </View>
      ))}
      {products.length === 0 && null /* estado vacío lo maneja la pantalla padre */}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
