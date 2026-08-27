import React, { useCallback, useState } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, 
  TouchableOpacity, ActivityIndicator, RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSales } from '../../hooks/useSales';
import { useSync } from '../../sync/useSync';
import { SyncBadge } from '../../components/SyncBadge';

export default function VentasScreen() {
  const router = useRouter();
  const { sales, loading, refreshSales } = useSales();
  const { syncNow, isSyncing } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshSales();
    }, [refreshSales])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await refreshSales();
    setRefreshing(false);
  };

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

  // Resumen de total acumulado
  const totalVendido = sales.reduce((acc, v) => acc + (Number(v.total) || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ventas ✨</Text>
          <Text style={styles.subtitle}>
            {sales.length} ventas • Total: ${totalVendido.toLocaleString('es-CL')}
          </Text>
        </View>
        <SyncBadge variant="pill" />
      </View>

      {/* Contenido */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7B5CF6" />
          <Text style={styles.loadingText}>Cargando ventas locales...</Text>
        </View>
      ) : sales.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing || isSyncing} 
              onRefresh={onRefresh} 
              tintColor="#7B5CF6" 
            />
          }
        >
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="bag-check-outline" size={40} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>Aún no registras ventas</Text>
            <Text style={styles.emptySub}>
              Cada venta que registres descontará stock automáticamente y se guardará tanto localmente como en Supabase.
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
        </ScrollView>
      ) : (
        <ScrollView 
          style={styles.listContainer} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing || isSyncing} 
              onRefresh={onRefresh} 
              tintColor="#7B5CF6" 
            />
          }
        >
          {sales.map((venta) => {
            const total = Math.round(Number(venta.total) || 0);
            const totalItems = venta.total_items || 1;
            const primerProducto = venta.first_product_name || 'Venta de productos';

            return (
              <View key={venta.id} style={styles.saleCard}>
                <View style={styles.iconCircle}>
                  <Feather name="check" size={18} color="#10B981" />
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
                  {Number(venta.discount) > 0 ? (
                    <Text style={styles.discountText}>Desc. -${Number(venta.discount).toLocaleString('es-CL')}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {/* Botón Flotante Inferior */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.fabBtn}
          onPress={() => router.push('/venta/nueva')}
          activeOpacity={0.85}
        >
          <Feather name="shopping-bag" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.fabBtnText}>Registrar nueva venta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 8, 
    paddingBottom: 10 
  },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  emptyScroll: { flexGrow: 1, justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', padding: 32 },
  emptyIconCircle: { 
    width: 68, 
    height: 68, 
    borderRadius: 34, 
    backgroundColor: '#ECFDF5', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  newSaleBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#10B981', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 14 
  },
  newSaleBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  listContainer: { paddingHorizontal: 16 },
  saleCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 14, 
    borderRadius: 16, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: { 
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    backgroundColor: '#ECFDF5', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  saleInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  fechaText: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  notesText: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  totalAmount: { fontSize: 16, fontWeight: '900', color: '#10B981' },
  discountText: { fontSize: 11, color: '#EF4444', marginTop: 2, fontWeight: '700' },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'rgba(255,255,255,0.95)', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#E2E8F0' 
  },
  fabBtn: { 
    backgroundColor: '#10B981', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 14, 
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  fabBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
