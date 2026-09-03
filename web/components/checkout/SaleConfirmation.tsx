/**
 * components/checkout/SaleConfirmation.tsx
 * Paso 4 del Checkout — Pantalla de éxito y confirmación con animación, estado de sincronización y botones de navegación.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BrandLogo } from '@/components/brand/BrandLogo';
import type { Sale } from '@/services/saleStorage';
import { formatCLP } from '@/utils/formatCurrency';

import { useToast } from '@/components/ui/Toast';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

type Props = {
  sale: Sale;
  onNewSale: () => void;
};

export function SaleConfirmation({ sale, onNewSale }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const iconScale = useSharedValue(0);

  const copyOrderNumber = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(sale.id);
    }
    toast.show({ message: `Pedido #${sale.id} copiado al portapapeles`, type: 'success' });
  };

  useEffect(() => {
    iconScale.value = withSequence(
      withSpring(1.2, theme.spring.bouncy),
      withSpring(1, theme.spring.snappy)
    );
  }, []);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const statusLabel = sale.status === 'confirmed'
    ? 'Confirmada'
    : sale.status === 'recovering'
      ? 'Verificando venta'
      : sale.status === 'conflict'
        ? 'Requiere revisión'
        : sale.status === 'rejected'
          ? 'Rechazada'
          : 'Pendiente de sincronización';
  const statusVariant = sale.status === 'confirmed' ? 'success' : sale.status === 'rejected' || sale.status === 'conflict' ? 'error' : 'warning';

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.crystalWrap,
          { backgroundColor: theme.colors.ivory, borderColor: theme.colors.champagneLight, borderRadius: theme.radius.full },
          iconAnimatedStyle,
        ]}
      >
        <BrandLogo variant="mark" width={66} />
      </Animated.View>

      <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 24, marginTop: 16, textAlign: 'center' }]}>
        {sale.status === 'confirmed'
          ? '¡Venta confirmada!'
          : sale.status === 'rejected'
            ? 'Venta rechazada'
            : sale.status === 'conflict'
              ? 'Venta en revisión'
              : '¡Venta guardada!'}
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textSecondary, marginTop: 6, textAlign: 'center', maxWidth: 300 },
        ]}
      >
        {sale.status === 'recovering'
          ? 'Estamos verificando el resultado remoto. No volveremos a cobrar ni descontar stock por este reintento.'
          : sale.status === 'confirmed'
            ? 'La venta, el pago y el stock quedaron confirmados. El comprobante se procesa de forma privada.'
            : sale.status === 'rejected'
              ? sale.conflictMessage || 'El servidor rechazó la venta y no modificó el stock remoto.'
              : sale.status === 'conflict'
                ? sale.conflictMessage || 'La venta requiere revisión por un cambio de precio o stock.'
                : 'La operación quedó protegida localmente y se sincronizará cuando exista conexión.'}
      </Text>

      {/* Ficha Resumen de la Venta */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            borderColor: theme.colors.border,
            ...theme.shadows.card,
          },
        ]}
      >
        <View style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Pedido</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '700', marginRight: 6 }]}>
              #{sale.id}
            </Text>
            <AnimatedPressable
              onPress={copyOrderNumber}
              hitSlop={8}
              accessibilityLabel="Copiar número de pedido"
              style={styles.copyOrderBtn}
            >
              <Feather name="copy" size={13} color={theme.colors.primary} />
            </AnimatedPressable>
          </View>
        </View>

        <View style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Total</Text>
          <Text style={[theme.typography.priceLarge, { color: theme.colors.primary, fontSize: 20 }]}>
            {formatCLP(sale.total)}
          </Text>
        </View>

        <View style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Comprobante</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="check" size={14} color={theme.colors.success} style={{ marginRight: 4 }} />
            <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '600' }]}>
              {sale.receipt?.status === 'attached' ? 'Asociado' : 'Pendiente privado'}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Estado</Text>
          <Badge variant={statusVariant}>
            {statusLabel}
          </Badge>
        </View>
      </View>

      {/* Botones de acción */}
      <View style={styles.actions}>
        <Button
          label="Ver mis compras"
          onPress={() => router.push('/historial')}
          variant="primary"
          size="lg"
          icon="clock"
        />
        <View style={{ height: 12 }} />
        <Button
          label="Seguir explorando"
          onPress={onNewSale}
          variant="secondary"
          size="lg"
          icon="shopping-bag"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystalWrap: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  summaryCard: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
    marginVertical: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  copyOrderBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    width: '100%',
  },
});
