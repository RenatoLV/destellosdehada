import React, { useCallback } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, 
  TouchableOpacity, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSales } from '../../hooks/useSales';

export default function VentasScreen() {
  const router = useRouter();
  const { sales, loading, refreshSales } = useSales();

  useFocusEffect(
    useCallback(() => {
      refreshSales();
    }, [refreshSales])
  );

  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ventas</Text>
        <Text style={styles.subtitle}>Historial de cobros realizados</Text>
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7B5CF6" />
          <Text style={styles.loadingText}>Cargando ventas...</Text>
        </View>
      ) : sales.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Feather name="shopping-bag" size={40} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>Aún no tienes ventas</Text>
          <Text style={styles.emptySub}>
            Cada cobro que confirmes quedará registrado aquí con su fecha y monto.
          </Text>
          <TouchableOpacity 
            style={styles.newSaleBtn}
            onPress={() => router.push('/venta/nueva')}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.newSaleBtnText}>Registrar primera venta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {sales.map((venta) => {
            const total = Math.round(Number(venta.total) || 0);
            const totalItems = venta.total_items || 1;
            const primerProducto = venta.first_product_name || 'Venta de productos';

            return (
              <View key={venta.id} style={styles.saleCard}>
                <View style={styles.iconCircle}>
                  <Feather name="check" size={20} color="#16A34A" />
                </View>

                <View style={styles.saleInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {primerProducto} {totalItems > 1 ? `(+${totalItems - 1} más)` : ''}
                  </Text>
                  <Text style={styles.fechaText}>{formatearFecha(venta.created_at)}</Text>
                  {venta.notes ? (
                    <Text style={styles.notesText} numberOfLines={1}>
                      "{venta.notes}"
                    </Text>
                  ) : null}
                </View>

                <View style={styles.amountCol}>
                  <Text style={styles.totalAmount}>${total.toLocaleString('es-CL')}</Text>
                  {venta.discount > 0 ? (
                    <Text style={styles.discountText}>Desc. -${venta.discount.toLocaleString('es-CL')}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Botón Flotante Inferior */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.fabBtn}
          onPress={() => router.push('/venta/nueva')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.fabBtnText}>Registrar nueva venta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 2 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6, marginBottom: 24, lineHeight: 20 },
  newSaleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7B5CF6', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  newSaleBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  listContainer: { paddingHorizontal: 20 },
  saleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  saleInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  fechaText: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  notesText: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  totalAmount: { fontSize: 16, fontWeight: '800', color: '#16A34A' },
  discountText: { fontSize: 11, color: '#DC2626', marginTop: 2, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  fabBtn: { backgroundColor: '#7B5CF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  fabBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});