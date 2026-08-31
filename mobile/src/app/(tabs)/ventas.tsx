import React, { useCallback, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, useWindowDimensions,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSales } from '../../hooks/useSales';
import { useSync } from '../../sync/useSync';
import { SyncBadge } from '../../components/SyncBadge';

export default function VentasScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = width < 360 ? 12 : 16;
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
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
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
            <ActivityIndicator size="large" color="#3E1F5C" />
          <Text style={styles.loadingText}>Cargando ventas locales...</Text>
        </View>
      ) : sales.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isSyncing}
              onRefresh={onRefresh}
              tintColor="#3E1F5C"
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
          style={[styles.listContainer, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isSyncing}
              onRefresh={onRefresh}
            tintColor="#3E1F5C"
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
                  <Text style={[
                    styles.syncStatusText,
                    venta.sync_status === 'failed' && styles.syncStatusFailed,
                    venta.sync_status === 'pending' && styles.syncStatusPending,
                  ]}>
                    {venta.sync_status === 'synced' ? 'Sincronizada' : venta.sync_status === 'failed' ? 'Requiere reintento' : 'Pendiente de sincronizar'}
                  </Text>
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
      <View style={[styles.footer, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(12, insets.bottom) }]}>
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
  container: { flex: 1, backgroundColor: '#F7F3ED' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10
  },
  title: { fontSize: 28, fontWeight: '500', color: '#241536', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#786F7D', marginTop: 4, fontWeight: '500' },
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
    backgroundColor: '#FFFDF9',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E3DBD1',
    boxShadow: '0px 1px 3px rgba(36, 21, 54, 0.03)',
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
  syncStatusText: { fontSize: 10, color: '#23805B', fontWeight: '700', marginTop: 3 },
  syncStatusFailed: { color: '#A64242' },
  syncStatusPending: { color: '#B27A16' },
  amountCol: { alignItems: 'flex-end' },
  totalAmount: { fontSize: 16, fontWeight: '900', color: '#2E7655' },
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
    backgroundColor: '#2E7655',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    boxShadow: '0px 4px 6px rgba(46, 118, 85, 0.30)',
    elevation: 3,
  },
  fabBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
