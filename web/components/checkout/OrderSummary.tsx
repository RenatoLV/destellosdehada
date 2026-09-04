import React from 'react';
import { Image, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useCart } from '@/context/CartContext';
import { formatCLP } from '@/utils/formatCurrency';
import { Button } from '@/components/ui/Button';

type Props = {
  onNext: () => void;
};

export function OrderSummary({ onNext }: Props) {
  const theme = useTheme();
  const { lines, subtotal, discount, discountAmount, total } = useCart();

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TU SELECCIÓN</Text>
      <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, marginBottom: 8 }]}>Revisa tu selección</Text>
      <Text style={styles.intro}>Confirma los productos y el total antes de continuar con tus datos.</Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {lines.map((line) => (
          <View key={line.product.id} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <Image
              source={{ uri: line.product.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '700' }]} numberOfLines={1}>
                {line.product.name}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {line.quantity} x {formatCLP(line.product.price)}
              </Text>
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '700' }]}>
              {formatCLP(line.product.price * line.quantity)}
            </Text>
          </View>
        ))}

        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Subtotal</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>{formatCLP(subtotal)}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[theme.typography.body, { color: theme.colors.success }]}>
                Descuento ({discount?.type === 'percent' ? `${discount.value}%` : '$'})
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.success }]}>
                -{formatCLP(discountAmount)}
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
            <Text style={[theme.typography.priceLarge, { color: theme.colors.text, fontSize: 18 }]}>Total a pagar</Text>
            <Text style={[theme.typography.priceLarge, { color: theme.colors.primary, fontSize: 18 }]}>{formatCLP(total)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Continuar al pago" variant="primary" size="lg" onPress={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { color: '#6F2138', fontSize: 9.5, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  intro: { color: '#65575B', fontSize: 13, lineHeight: 20, marginBottom: 22 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3E9DA',
  },
  summaryBlock: {
    padding: 16,
    backgroundColor: '#FBF5EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actions: {
    marginTop: 24,
  },
});
