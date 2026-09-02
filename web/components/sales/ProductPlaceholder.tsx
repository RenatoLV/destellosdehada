/**
 * components/sales/ProductPlaceholder.tsx
 * Placeholder premium de joyería para piezas sin fotografía.
 * Evita el defecto visual de cajas vacías o aspecto roto; proyecta alta gama y pulcritud.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { BrandLogo } from '@/components/brand/BrandLogo';

type Props = {
  category?: string;
  sku?: string;
};

export function ProductPlaceholder({ category, sku }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.ivory, borderColor: theme.colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.champagneLight }]}>
        <BrandLogo variant="mark" width={40} />
      </View>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Fotografía en estudio</Text>
      {sku && <Text style={[styles.skuText, { color: theme.colors.textMuted }]}>{sku}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  skuText: {
    fontSize: 10,
    marginTop: 2,
  },
});
