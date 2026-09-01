import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { SaleResultStatus, formatCurrency } from '../../domain/pos';
import { POSColors, POSRadius, POSTypography } from '../../constants/posTheme';

interface Props {
  status: SaleResultStatus;
  total: number;
  clientName: string | null;
  receiptStatus: 'pending' | 'uploading' | 'uploaded' | 'attached' | 'failed';
  conflictCode?: string | null;
  conflictMessage?: string | null;
  isOnline: boolean;
  onNewSale: () => void;
  onViewSales: () => void;
}

const CONTENT: Record<SaleResultStatus, { icon: keyof typeof Feather.glyphMap; title: string; description: string; tone: 'success' | 'warning' | 'danger' | 'plum' }> = {
  pending: { icon: 'clock', title: 'Venta registrada', description: 'Guardada en este dispositivo. Se sincronizará automáticamente cuando haya conexión.', tone: 'warning' },
  confirmed: { icon: 'check', title: 'Venta confirmada', description: 'La venta, el pago y el inventario fueron confirmados.', tone: 'success' },
  rejected: { icon: 'x', title: 'Venta no confirmada', description: 'No se pudo completar la venta. Revisa el detalle antes de intentarlo nuevamente.', tone: 'danger' },
  conflict: { icon: 'alert-triangle', title: 'Venta requiere revisión', description: 'La operación no fue confirmada y el inventario local fue reconciliado.', tone: 'danger' },
  recovering: { icon: 'shield', title: 'Estamos verificando la venta', description: 'No vuelvas a realizar el pago. Estamos consultando el resultado real de la operación.', tone: 'plum' },
};

export function CheckoutStatus(props: Props) {
  const content = CONTENT[props.status];
  const toneStyle = styles[content.tone];
  const stockConflict = props.conflictCode === 'STOCK_INSUFFICIENT' || props.conflictCode === 'STOCK_CONFLICT';
  const priceChanged = props.conflictCode === 'PRICE_CHANGED';
  const detail = stockConflict
    ? 'Uno de los productos ya no tiene stock suficiente. El inventario fue actualizado.'
    : priceChanged
      ? 'El precio de uno de los productos cambió. Revisa el carrito antes de continuar.'
      : props.conflictMessage;
  const receiptLabel = {
    pending: 'Pendiente',
    uploading: 'Subiendo',
    uploaded: 'Asociando',
    attached: 'Adjuntado',
    failed: 'Requiere atención',
  }[props.receiptStatus];

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.wrapper}>
      <Animated.View entering={ZoomIn.duration(340)} style={[styles.iconCircle, toneStyle]}>
        {props.status === 'recovering'
          ? <ActivityIndicator color={POSColors.plum} />
          : <Feather name={content.icon} size={34} color={props.status === 'confirmed' ? POSColors.white : POSColors.ink} />}
      </Animated.View>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.description}>{detail || content.description}</Text>
      <Text style={styles.amount}>{formatCurrency(props.total)}</Text>

      <View style={styles.detailCard}>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>Cliente</Text><Text style={styles.detailValue}>{props.clientName ?? 'Venta sin cliente'}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>Pago</Text><Text style={styles.detailValue}>Transferencia</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>Comprobante</Text><Text style={styles.detailValue}>{receiptLabel}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>Estado</Text><Text style={styles.detailValue}>{props.status === 'pending' && !props.isOnline ? 'Pendiente · sin conexión' : content.title}</Text></View>
      </View>

      {(props.status === 'pending' || props.status === 'confirmed') && (
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Iniciar nueva venta" style={styles.primaryButton} onPress={props.onNewSale}>
            <Feather name="plus" size={17} color={POSColors.white} /><Text style={styles.primaryText}>Nueva venta</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver ventas" style={styles.secondaryButton} onPress={props.onViewSales}>
            <Text style={styles.secondaryText}>Ver ventas</Text>
          </TouchableOpacity>
        </View>
      )}
      {(props.status === 'rejected' || props.status === 'conflict') && (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver a ventas" style={styles.secondaryButton} onPress={props.onViewSales}>
          <Text style={styles.secondaryText}>Revisar ventas</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 28, maxWidth: 570, width: '100%', alignSelf: 'center' },
  iconCircle: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  success: { backgroundColor: POSColors.success },
  warning: { backgroundColor: POSColors.warningSoft },
  danger: { backgroundColor: POSColors.dangerSoft },
  plum: { backgroundColor: POSColors.plumSoft },
  title: { fontFamily: POSTypography.serif, color: POSColors.ink, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  description: { color: POSColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 430, marginTop: 9 },
  amount: { color: POSColors.plum, fontFamily: POSTypography.serif, fontSize: 34, fontWeight: '900', marginTop: 22 },
  detailCard: { width: '100%', marginTop: 24, padding: 17, borderWidth: 1, borderColor: POSColors.border, borderRadius: POSRadius.large, backgroundColor: POSColors.surface, gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  detailLabel: { color: POSColors.muted, fontSize: 12 },
  detailValue: { flex: 1, color: POSColors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  actions: { width: '100%', marginTop: 22, gap: 10 },
  primaryButton: { minHeight: 52, borderRadius: POSRadius.medium, backgroundColor: POSColors.plum, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryText: { color: POSColors.white, fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 50, width: '100%', borderRadius: POSRadius.medium, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: POSColors.plum, fontSize: 13, fontWeight: '900' },
});
