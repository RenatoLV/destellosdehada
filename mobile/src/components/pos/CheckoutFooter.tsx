import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatCurrency } from '../../domain/pos';
import { POSColors, POSRadius } from '../../constants/posTheme';

interface Props {
  total: number;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  showTotal?: boolean;
}

export function CheckoutFooter({ total, label, onPress, disabled = false, loading = false, showTotal = true }: Props) {
  return (
    <View style={styles.container}>
      {showTotal && <View><Text style={styles.totalLabel}>TOTAL</Text><Text style={styles.total}>{formatCurrency(total)}</Text></View>}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Continúa al siguiente paso del checkout"
        activeOpacity={0.86}
        style={[styles.button, !showTotal && styles.buttonWide, (disabled || loading) && styles.disabled]}
        onPress={onPress}
        disabled={disabled || loading}
      >
        {loading ? <ActivityIndicator color={POSColors.white} /> : <><Text style={styles.buttonText}>{label}</Text><Feather name="arrow-right" size={17} color={POSColors.white} /></>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 76, backgroundColor: POSColors.surface, borderTopWidth: 1, borderTopColor: POSColors.border, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, boxShadow: '0px -5px 18px rgba(57, 35, 63, 0.07)' },
  totalLabel: { color: POSColors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  total: { color: POSColors.ink, fontSize: 19, fontWeight: '900', marginTop: 2 },
  button: { minHeight: 50, minWidth: 166, borderRadius: POSRadius.medium, backgroundColor: POSColors.plum, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonWide: { flex: 1 },
  buttonText: { color: POSColors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.48 },
});
