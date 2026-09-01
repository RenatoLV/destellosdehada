import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckoutStep } from '../../domain/pos';
import { POSColors, POSRadius, POSTypography } from '../../constants/posTheme';

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: 'cart', label: 'Carrito' },
  { key: 'client', label: 'Cliente' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'receipt', label: 'Comprobante' },
  { key: 'confirmation', label: 'Confirmación' },
];

function visibleIndex(step: CheckoutStep): number {
  if (step === 'processing') return 4;
  return Math.max(0, STEPS.findIndex(item => item.key === step));
}

export function CheckoutProgress({ step, compact = false }: { step: CheckoutStep; compact?: boolean }) {
  const activeIndex = visibleIndex(step);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Paso ${activeIndex + 1} de 5: ${STEPS[activeIndex].label}`}>
      <View style={styles.row}>
        {STEPS.map((item, index) => (
          <React.Fragment key={item.key}>
            {index > 0 && <View style={[styles.line, index <= activeIndex && styles.lineActive]} />}
            <View style={styles.step}>
              <View style={[styles.dot, index <= activeIndex && styles.dotActive, index < activeIndex && styles.dotComplete]}>
                <Text style={[styles.dotText, index <= activeIndex && styles.dotTextActive]}>{index < activeIndex ? '✓' : index + 1}</Text>
              </View>
              {!compact && <Text style={[styles.label, index === activeIndex && styles.labelActive]} numberOfLines={1}>{item.label}</Text>}
            </View>
          </React.Fragment>
        ))}
      </View>
      {compact && <Text style={styles.mobileLabel}>Paso {activeIndex + 1} de 5 · {STEPS[activeIndex].label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', width: 28 },
  line: { flex: 1, height: 1, backgroundColor: POSColors.border, marginTop: 13, marginHorizontal: 4 },
  lineActive: { backgroundColor: POSColors.gold },
  dot: { width: 28, height: 28, borderRadius: POSRadius.pill, borderWidth: 1, borderColor: POSColors.border, backgroundColor: POSColors.surface, alignItems: 'center', justifyContent: 'center' },
  dotActive: { borderColor: POSColors.plum, backgroundColor: POSColors.plumSoft },
  dotComplete: { backgroundColor: POSColors.plum, borderColor: POSColors.plum },
  dotText: { fontSize: 11, fontWeight: '800', color: POSColors.muted },
  dotTextActive: { color: POSColors.plum },
  label: { fontFamily: POSTypography.sans, marginTop: 7, fontSize: 10, color: POSColors.muted, width: 74, textAlign: 'center' },
  labelActive: { color: POSColors.ink, fontWeight: '800' },
  mobileLabel: { marginTop: 9, textAlign: 'center', fontSize: 12, fontWeight: '700', color: POSColors.muted },
});
