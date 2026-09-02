import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useCart } from '@/context/CartContext';
import { formatCLP } from '@/utils/formatCurrency';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

type Props = {
  onContinue?: () => void;
};

const FREE_SHIPPING_THRESHOLD = 50000;

export function CartSummary({ onContinue }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { subtotal, total, itemCount } = useCart();
  const isEmpty = itemCount === 0;

  const missing = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleCheckout = () => {
    onContinue?.();
    router.push('/checkout' as never);
  };

  return (
    <View style={styles.container}>
      {/* Free Shipping Progress */}
      {!isEmpty && (
        <View style={styles.shippingProgressContainer}>
          {missing > 0 ? (
            <Text style={styles.shippingText}>
              Te faltan <Text style={{ fontWeight: '700', color: theme.colors.primary }}>{formatCLP(missing)}</Text> para despacho gratis
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Feather name="truck" size={13} color={theme.colors.success} />
              <Text style={[styles.shippingText, { color: theme.colors.success, marginBottom: 0 }]}>
                ¡Despacho gratis desbloqueado!
              </Text>
            </View>
          )}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: theme.colors.success }]} />
          </View>
        </View>
      )}

      {/* Desglose de totales */}
      <View style={styles.breakdown}>
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.value}>{formatCLP(subtotal)}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <AnimatedNumber
            value={formatCLP(total)}
            style={styles.totalValue}
          />
        </View>
      </View>

      {/* Botón Continuar */}
      <AnimatedPressable
        onPress={handleCheckout}
        disabled={isEmpty}
        scale={0.97}
        style={[
          styles.checkoutButton,
          { backgroundColor: isEmpty ? theme.colors.border : theme.colors.primary },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continuar al pago"
      >
        <Text style={styles.checkoutText}>Continuar al checkout</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FBF5EB',
    borderTopWidth: 1,
    borderTopColor: 'rgba(84, 24, 43, 0.1)',
  },
  shippingProgressContainer: {
    marginBottom: 16,
  },
  shippingText: {
    fontSize: 11.5,
    color: '#65575B',
    marginBottom: 6,

  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#EAE3D6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdown: {
    gap: 8,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#54182B',

  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#54182B',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(84, 24, 43, 0.1)',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#54182B',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#54182B',
  },
  checkoutButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',

  },
});
