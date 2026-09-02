/**
 * components/sales/SaleDetailModal.tsx
 * Modal para ver el detalle completo de una venta del historial (items, cliente, comprobante con zoom).
 */
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import type { Sale } from '@/services/saleStorage';
import { formatCLP } from '@/utils/formatCurrency';

type Props = {
  sale: Sale | null;
  visible: boolean;
  onClose: () => void;
};

export function SaleDetailModal({ sale, visible, onClose }: Props) {
  const theme = useTheme();

  if (!sale) return null;

  const dateFormatted = new Date(sale.createdAt).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[theme.typography.sectionTitle, { color: theme.colors.text }]}>
                  Pedido #{sale.id}
                </Text>
                <Badge variant={sale.synced ? 'success' : 'warning'}>
                  {sale.synced ? 'Sincronizada' : 'Pendiente sync'}
                </Badge>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                {dateFormatted} • Ref: {sale.reference}
              </Text>
            </View>

            <IconButton icon="x" size={16} onPress={onClose} accessibilityLabel="Cerrar detalle" />
          </View>

          <ScrollView style={styles.content}>
            {/* Cliente */}
            {sale.customer.fullName || sale.customer.phone ? (
              <View style={[styles.section, { backgroundColor: theme.colors.background, borderRadius: theme.radius.lg }]}>
                <Text style={[theme.typography.label, { color: theme.colors.primary, marginBottom: 6 }]}>
                  Datos del Cliente
                </Text>
                {sale.customer.fullName && (
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                    {sale.customer.fullName}
                  </Text>
                )}
                {sale.customer.phone && (
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    Tel: {sale.customer.phone} {sale.customer.email ? `• ${sale.customer.email}` : ''}
                  </Text>
                )}
                {sale.customer.notes && (
                  <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 6, fontStyle: 'italic' }]}>
                    "{sale.customer.notes}"
                  </Text>
                )}
              </View>
            ) : null}

            {/* Productos */}
            <View style={{ marginVertical: 12 }}>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                Productos seleccionados ({sale.items.length})
              </Text>

              {sale.items.map((line) => (
                <View
                  key={line.product.id}
                  style={[styles.itemRow, { borderBottomColor: theme.colors.border }]}
                >
                  <View style={[styles.thumb, { backgroundColor: theme.colors.lavender, borderRadius: theme.radius.sm }]}>
                    {line.product.imageUrl ? (
                      <Image source={{ uri: line.product.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <Feather name="feather" size={16} color={theme.colors.primary} />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                      {line.product.name}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      {line.quantity} × {formatCLP(line.product.price)}
                    </Text>
                  </View>

                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '600' }]}>
                    {formatCLP(line.product.price * line.quantity)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Desglose total */}
            <View style={[styles.summaryBox, { borderTopColor: theme.colors.border }]}>
              <View style={styles.sumRow}>
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Subtotal</Text>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                  {formatCLP(sale.subtotal)}
                </Text>
              </View>

              {sale.discountAmount > 0 && (
                <View style={styles.sumRow}>
                  <Text style={[theme.typography.body, { color: theme.colors.primary }]}>
                    Descuento ({sale.discount?.type === 'percent' ? `${sale.discount.value}%` : '$'})
                  </Text>
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.primary }]}>
                    − {formatCLP(sale.discountAmount)}
                  </Text>
                </View>
              )}

              <View style={[styles.sumRow, { marginTop: 8, paddingTop: 8, borderTopColor: theme.colors.border, borderTopWidth: 1 }]}>
                <Text style={[theme.typography.sectionTitle, { color: theme.colors.text }]}>TOTAL</Text>
                <Text style={[theme.typography.priceLarge, { color: theme.colors.text, fontSize: 20 }]}>
                  {formatCLP(sale.total)}
                </Text>
              </View>
            </View>

            {/* Comprobante */}
            {sale.receipt && (
              <View style={{ marginTop: 16 }}>
                <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                  Comprobante adjuntado
                </Text>
                <View style={[styles.receiptBox, { backgroundColor: theme.colors.background, borderRadius: theme.radius.lg, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Feather name="file-text" size={16} color={theme.colors.primary} />
                    <Text style={[theme.typography.caption, { color: theme.colors.text, marginLeft: 6, fontWeight: '600' }]}>
                      {sale.receipt.fileName} ({sale.receipt.fileSize})
                    </Text>
                  </View>

                  {sale.receipt.previewUri && (
                    <Image source={{ uri: sale.receipt.previewUri }} style={styles.receiptImg} resizeMode="contain" />
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  content: {
    paddingVertical: 12,
  },
  section: {
    padding: 12,
    marginTop: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  thumb: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  summaryBox: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  receiptBox: {
    padding: 12,
    borderWidth: 1,
  },
  receiptImg: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
});
