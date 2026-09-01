import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CartItem, CartTotals, formatCurrency, ReceiptSelection } from '../../domain/pos';
import { Client } from '../../types/database';
import { POSColors, POSRadius, POSTypography } from '../../constants/posTheme';

interface Props {
  cart: CartItem[];
  totals: CartTotals;
  client: Client | null;
  receipt: ReceiptSelection | null;
}

export function CheckoutSummary({ cart, totals, client, receipt }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>RESUMEN DE VENTA</Text>
      <Text style={styles.title}>{totals.totalItems} {totals.totalItems === 1 ? 'pieza' : 'piezas'}</Text>
      <View style={styles.items}>
        {cart.slice(0, 4).map(item => (
          <View key={item.product.id} style={styles.item}>
            <View style={styles.thumb}>
              {item.product.image_uri
                ? <Image source={{ uri: item.product.image_uri }} style={styles.image} />
                : <Feather name="circle" size={15} color={POSColors.lavender} />}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
              <Text style={styles.itemMeta}>{item.quantity} × {formatCurrency(item.unitPrice)}</Text>
            </View>
            <Text style={styles.itemAmount}>{formatCurrency(item.quantity * item.unitPrice)}</Text>
          </View>
        ))}
        {cart.length > 4 && <Text style={styles.more}>+ {cart.length - 4} productos más</Text>}
      </View>

      <View style={styles.divider} />
      <View style={styles.totalRow}><Text style={styles.muted}>Subtotal</Text><Text style={styles.value}>{formatCurrency(totals.subtotal)}</Text></View>
      <View style={styles.totalRow}><Text style={styles.muted}>Descuento</Text><Text style={styles.discount}>− {formatCurrency(totals.discount)}</Text></View>
      <View style={[styles.totalRow, styles.grandRow]}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandTotal}>{formatCurrency(totals.total)}</Text></View>

      <View style={styles.contextCard}>
        <View style={styles.contextRow}><Feather name="user" size={15} color={POSColors.plum} /><Text style={styles.contextText}>{client?.name ?? 'Venta sin cliente'}</Text></View>
        <View style={styles.contextRow}><Feather name="credit-card" size={15} color={POSColors.plum} /><Text style={styles.contextText}>Transferencia</Text></View>
        <View style={styles.contextRow}><Feather name="paperclip" size={15} color={receipt ? POSColors.success : POSColors.muted} /><Text style={styles.contextText}>{receipt ? 'Comprobante seleccionado' : 'Comprobante pendiente'}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, borderRadius: POSRadius.large, padding: 20, boxShadow: '0px 10px 28px rgba(57, 35, 63, 0.08)' },
  eyebrow: { color: POSColors.gold, fontSize: 10, letterSpacing: 1.4, fontWeight: '900' },
  title: { marginTop: 6, fontFamily: POSTypography.serif, fontSize: 24, color: POSColors.ink, fontWeight: '700' },
  items: { marginTop: 16, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 38, height: 38, borderRadius: 11, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, marginHorizontal: 10 },
  itemName: { color: POSColors.ink, fontSize: 12, fontWeight: '800' },
  itemMeta: { color: POSColors.muted, fontSize: 10, marginTop: 2 },
  itemAmount: { color: POSColors.ink, fontSize: 11, fontWeight: '800' },
  more: { color: POSColors.muted, fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: POSColors.border, marginVertical: 18 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  muted: { color: POSColors.muted, fontSize: 12 },
  value: { color: POSColors.ink, fontSize: 12, fontWeight: '700' },
  discount: { color: POSColors.success, fontSize: 12, fontWeight: '800' },
  grandRow: { marginTop: 6, marginBottom: 0, paddingTop: 13, borderTopWidth: 1, borderTopColor: POSColors.border },
  grandLabel: { color: POSColors.ink, fontSize: 15, fontWeight: '800' },
  grandTotal: { color: POSColors.plum, fontFamily: POSTypography.serif, fontSize: 25, fontWeight: '800' },
  contextCard: { marginTop: 18, borderRadius: POSRadius.medium, padding: 13, backgroundColor: POSColors.surfaceMuted, gap: 9 },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  contextText: { flex: 1, color: POSColors.ink, fontSize: 11, fontWeight: '600' },
});
