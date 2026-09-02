/**
 * components/sales/ProductSkeleton.tsx
 * Skeleton para tarjetas de joyas durante la carga o filtrado.
 */
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

export function ProductSkeleton() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 14,
        },
      ]}
    >
      {/* Imagen cuadrada */}
      <View style={styles.imageWrap}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
      </View>

      {/* Info */}
      <View style={styles.infoSection}>
        <Skeleton width="75%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
        <Skeleton width="45%" height={11} borderRadius={4} style={{ marginBottom: 12 }} />

        <View style={styles.priceRow}>
          <Skeleton width="50%" height={18} borderRadius={4} />
          <Skeleton width={32} height={32} borderRadius={16} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    flex: 1,
    marginBottom: 10,
  },
  imageWrap: {
    aspectRatio: 1,
    width: '100%',
  },
  infoSection: {
    padding: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
