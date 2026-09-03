/**
 * components/checkout/TransferStep.tsx
 * Paso 2 del Checkout — Información para realizar la Transferencia Bancaria.
 * Incluye botones de copiado con feedback y caja de monto destacado protagónico.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useToast } from '@/components/ui/Toast';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { BANK_DETAILS } from '@/services/saleStorage';
import { formatCLP } from '@/utils/formatCurrency';

type Props = {
  total: number;
  reference: string;
  onNext: () => void;
};

export function TransferStep({ total, reference, onNext }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    toast.show({ message: `${label} copiado`, type: 'success' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const rows = [
    { key: 'bank', label: 'Banco', value: BANK_DETAILS.bankName },
    { key: 'holder', label: 'Titular', value: BANK_DETAILS.accountHolder },
    { key: 'rut', label: 'RUT', value: BANK_DETAILS.rut },
    { key: 'type', label: 'Tipo de cuenta', value: BANK_DETAILS.accountType },
    { key: 'acc', label: 'Cuenta corriente', value: BANK_DETAILS.accountNumber },
    { key: 'email', label: 'Email', value: BANK_DETAILS.email },
  ];
  const bankDetailsConfigured = rows.every((row) => row.value.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 20 }]}>
          Realiza tu transferencia
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>
          Transfiere desde tu banco usando los siguientes datos oficiales:
        </Text>
      </View>

      {!bankDetailsConfigured && (
        <View style={[styles.configWarning, { backgroundColor: theme.colors.lavender, borderColor: theme.colors.border }] }>
          <Feather name="alert-circle" size={17} color={theme.colors.primary} />
          <Text style={[theme.typography.body, { color: theme.colors.primary, flex: 1 }]}>Los datos bancarios todavía no están configurados. Completa las variables EXPO_PUBLIC_TRANSFER_* antes de registrar ventas.</Text>
        </View>
      )}

      {/* Lista de datos bancarios */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border }]}>
        {rows.map((row, idx) => (
          <View
            key={row.key}
            style={[
              styles.row,
              idx < rows.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: 1 },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{row.label}</Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 2 }]}>{row.value || 'No configurado'}</Text>
            </View>
            <AnimatedPressable
              onPress={() => row.value && copyToClipboard(row.value, row.label, row.key)}
              haptic="light"
              style={[
                styles.copyBtn,
                {
                  backgroundColor: copiedKey === row.key ? theme.colors.lavender : 'transparent',
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.full,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Copiar ${row.label}`}
            >
              <Feather
                name={copiedKey === row.key ? 'check' : 'copy'}
                size={13}
                color={copiedKey === row.key ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: copiedKey === row.key ? theme.colors.primary : theme.colors.textSecondary,
                    marginLeft: 4,
                    fontWeight: '600',
                  },
                ]}
              >
                {copiedKey === row.key ? 'Copiado' : 'Copiar'}
              </Text>
            </AnimatedPressable>
          </View>
        ))}
      </View>

      {/* Caja de Monto Destacado */}
      <View
        style={[
          styles.amountCard,
          {
            backgroundColor: theme.colors.lavender,
            borderColor: theme.colors.primaryLight,
            borderRadius: theme.radius.xl,
          },
        ]}
      >
        <Text style={[theme.typography.caption, { color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 1 }]}>
          Monto exacto a transferir
        </Text>
        <Text style={[theme.typography.priceLarge, { color: theme.colors.primary, fontSize: 32, marginVertical: 6 }]}>
          {formatCLP(total)}
        </Text>
        <AnimatedPressable
          onPress={() => copyToClipboard(String(total), 'Monto', 'monto')}
          haptic="light"
          style={[
            styles.copyAmountBtn,
            { backgroundColor: theme.colors.primary, borderRadius: theme.radius.full },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Copiar monto a transferir"
        >
          <Feather name="copy" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={[theme.typography.bodyMedium, { color: '#FFFFFF', fontWeight: '600' }]}>
            {copiedKey === 'monto' ? 'Monto copiado' : 'Copiar monto'}
          </Text>
        </AnimatedPressable>
      </View>

      {/* Referencia opcional */}
      <View style={[styles.refBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Referencia (opcional)</Text>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '600', marginTop: 2 }]}>
            {reference}
          </Text>
        </View>
        <AnimatedPressable
          onPress={() => copyToClipboard(reference, 'Referencia', 'ref')}
          haptic="light"
          style={[styles.copyBtn, { borderColor: theme.colors.border, borderRadius: theme.radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Copiar referencia"
        >
          <Feather name="copy" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginLeft: 4 }]}>Copiar</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.footer}>
        <Button label="Ya transferí →" onPress={onNext} disabled={!bankDetailsConfigured} variant="primary" size="lg" icon="arrow-right" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 16,
  },
  configWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 16 },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
  },
  amountCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  copyAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    minHeight: 44,
    marginTop: 4,
  },
  refBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  footer: {
    marginTop: 24,
  },
});
