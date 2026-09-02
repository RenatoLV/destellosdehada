/**
 * components/sales/DiscountModal.tsx
 * Modal discreto para aplicar descuento a la venta actual (% o monto CLP).
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useCart } from '@/context/CartContext';
import { formatCLP } from '@/utils/formatCurrency';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PRESET_PERCENTS = [5, 10, 15, 20];

export function DiscountModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const { discount, setDiscount, subtotal } = useCart();
  const [type, setType] = useState<'percent' | 'amount'>(discount?.type || 'percent');
  const [valueStr, setValueStr] = useState(discount ? String(discount.value) : '10');

  const handleApply = () => {
    const num = parseFloat(valueStr) || 0;
    if (num > 0) {
      setDiscount({ type, value: num });
    } else {
      setDiscount(null);
    }
    onClose();
  };

  const handleRemove = () => {
    setDiscount(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              ...theme.shadows.dialog,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[theme.typography.sectionTitle, { color: theme.colors.text }]}>
              Aplicar descuento
            </Text>
            <IconButton icon="x" size={16} onPress={onClose} accessibilityLabel="Cerrar modal de descuento" />
          </View>

          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setType('percent')}
              style={[
                styles.tab,
                {
                  backgroundColor: type === 'percent' ? theme.colors.lavender : 'transparent',
                  borderColor: type === 'percent' ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radius.full,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.label,
                  { color: type === 'percent' ? theme.colors.primary : theme.colors.textSecondary },
                ]}
              >
                Porcentaje (%)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('amount')}
              style={[
                styles.tab,
                {
                  backgroundColor: type === 'amount' ? theme.colors.lavender : 'transparent',
                  borderColor: type === 'amount' ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radius.full,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.label,
                  { color: type === 'amount' ? theme.colors.primary : theme.colors.textSecondary },
                ]}
              >
                Monto ($ CLP)
              </Text>
            </Pressable>
          </View>

          {type === 'percent' ? (
            <View style={styles.presetsRow}>
              {PRESET_PERCENTS.map((pct) => (
                <Pressable
                  key={pct}
                  onPress={() => setValueStr(String(pct))}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: valueStr === String(pct) ? theme.colors.primary : theme.colors.background,
                      borderRadius: theme.radius.md,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.bodyMedium,
                      { color: valueStr === String(pct) ? '#FFFFFF' : theme.colors.text },
                    ]}
                  >
                    {pct}%
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
              Subtotal actual: {formatCLP(subtotal)}
            </Text>
          )}

          <View style={[styles.inputWrap, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary, marginRight: 8 }]}>
              {type === 'percent' ? '%' : '$'}
            </Text>
            <TextInput
              value={valueStr}
              onChangeText={setValueStr}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.colors.textSecondary}
              style={[theme.typography.bodyMedium, { flex: 1, color: theme.colors.text }]}
              autoFocus
            />
          </View>

          <View style={styles.actions}>
            {discount && (
              <Button label="Quitar descuento" variant="danger" onPress={handleRemove} size="md" />
            )}
            <Button label="Aplicar" variant="primary" onPress={handleApply} size="md" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
});
