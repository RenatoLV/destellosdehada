import React, { useMemo, useCallback, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, RefreshControl, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { useSync } from '../../sync/useSync';
import { SyncBadge } from '../../components/SyncBadge';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 12 : 16;
  const { products, loading: loadingProducts, refreshProducts } = useProducts();
  const { sales, loading: loadingSales, refreshSales } = useSales();
  const { syncNow, isSyncing } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  // Recargar métricas al enfocarse en la pestaña de Inicio
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
      refreshSales();
    }, [refreshProducts, refreshSales])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await Promise.all([refreshProducts(), refreshSales()]);
    setRefreshing(false);
  };

  // --- CÁLCULO DE MÉTRICAS EN TIEMPO REAL ---
  const metricas = useMemo(() => {
    const totalProductos = products.length;
    const stockBajo = products.filter(p => Number(p.stock) <= 2).length;
    const valorInventario = products.reduce((acc, p) => acc + (Number(p.price) * Number(p.stock)), 0);

    const hoyStr = new Date().toISOString().split('T')[0];
    const ventasHoyLista = sales.filter(s => {
      if (!s.created_at) return false;
      const fechaVenta = new Date(s.created_at).toISOString().split('T')[0];
      return fechaVenta === hoyStr;
    });

    const ventasHoyTotal = ventasHoyLista.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const ventasHoyCount = ventasHoyLista.length;

    return {
      totalProductos,
      stockBajo,
      valorInventario,
      ventasHoyCount,
      ventasHoyTotal,
    };
  }, [products, sales]);

  const ultimosProductos = useMemo(() => {
    return products.slice(0, 4);
  }, [products]);

  const isLoading = loadingProducts || loadingSales;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isSyncing}
            onRefresh={onRefresh}
            tintColor="#3E1F5C"
            colors={['#3E1F5C']}
          />
        }
      >
        {/* Barra superior de marca */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.sparkleIcon}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>Destellos de Hada</Text>
          </View>
          <View style={styles.topActions}>
            <SyncBadge variant="pill" />
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(tabs)/mas')} activeOpacity={0.7}>
              <Feather name="settings" size={18} color="#241536" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>CENTRO DE OPERACIONES</Text>
          <Text style={styles.heroTitle}>Todo bajo control.</Text>
          <Text style={styles.heroText}>Revisa primero lo que necesita acción y luego consulta el rendimiento de tu tienda.</Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroPrimary} onPress={() => router.push('/venta/nueva')} activeOpacity={0.85}>
              <Feather name="plus" size={15} color="#3E1F5C" /><Text style={styles.heroPrimaryText}>Nueva venta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroGhost} onPress={() => router.push('/(tabs)/ventas')} activeOpacity={0.85}>
              <Text style={styles.heroGhostText}>Ver ventas</Text><Feather name="arrow-up-right" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Pendientes de hoy</Text><Text style={styles.sectionSubtitle}>Acciones que necesitan atención</Text></View>
          <Text style={styles.linkText}>{metricas.stockBajo} alertas</Text>
        </View>
        <View style={styles.pendingList}>
          <TouchableOpacity style={styles.pendingRow} onPress={() => router.push('/(tabs)/inventario')} activeOpacity={0.75}>
            <View style={[styles.pendingIcon, styles.pendingIconRed]}><Feather name="alert-triangle" size={16} color="#A64242" /></View>
            <View style={styles.pendingMain}><Text style={styles.pendingTitle}>Productos bajo mínimo</Text><Text style={styles.pendingText}>Revisa stock y reposición</Text></View>
            <Text style={styles.pendingCount}>{metricas.stockBajo}</Text><Feather name="chevron-right" size={16} color="#B9AFB5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pendingRow} onPress={() => router.push('/venta/nueva')} activeOpacity={0.75}>
            <View style={[styles.pendingIcon, styles.pendingIconGreen]}><Feather name="shopping-bag" size={16} color="#2E7655" /></View>
            <View style={styles.pendingMain}><Text style={styles.pendingTitle}>Registrar una venta</Text><Text style={styles.pendingText}>Mantén actualizado tu flujo</Text></View>
            <Feather name="plus-circle" size={18} color="#2E7655" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Resumen</Text><Text style={styles.sectionSubtitle}>Actividad de hoy</Text></View>
          <Text style={styles.linkText}>Hoy</Text>
        </View>
        {/* Tarjetas de Resumen (Grid 2x2) */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#3E1F5C" />
            <Text style={styles.loadingText}>Cargando inventario local...</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderLeftColor: '#3E1F5C' }]}>
              <View style={styles.statIconBoxPurple}>
                <Feather name="box" size={16} color="#3E1F5C" />
              </View>
              <Text style={styles.statLabel}>Productos</Text>
              <Text style={styles.statValue}>{metricas.totalProductos}</Text>
            </View>

            <View style={[styles.statCard, { borderLeftColor: '#2E7655' }]}>
              <View style={styles.statIconBoxGreen}>
                <Feather name="trending-up" size={16} color="#2E7655" />
              </View>
              <Text style={styles.statLabel}>Ventas hoy</Text>
              <Text style={styles.statValue}>
                {metricas.ventasHoyCount} {metricas.ventasHoyTotal > 0 ? `(\$${metricas.ventasHoyTotal.toLocaleString('es-CL')})` : ''}
              </Text>
            </View>

            <View style={[styles.statCard, { borderLeftColor: '#65427D' }]}>
              <View style={styles.statIconBoxIndigo}>
                <Feather name="dollar-sign" size={16} color="#65427D" />
              </View>
              <Text style={styles.statLabel}>Valor catálogo</Text>
              <Text style={styles.statValue}>${metricas.valorInventario.toLocaleString('es-CL')}</Text>
            </View>

            <View style={[styles.statCard, { borderLeftColor: metricas.stockBajo > 0 ? '#A64242' : '#E3DBD1' }]}>
              <View style={metricas.stockBajo > 0 ? styles.statIconBoxRed : styles.statIconBoxGray}>
                <Feather name="alert-triangle" size={16} color={metricas.stockBajo > 0 ? "#A64242" : "#786F7D"} />
              </View>
              <Text style={styles.statLabel}>Stock bajo</Text>
                <Text style={[styles.statValue, metricas.stockBajo > 0 && { color: '#A64242' }]}>
                {metricas.stockBajo}
              </Text>
            </View>
          </View>
        )}

        {/* Acciones Rápidas Táctiles (Mobile Friendly) */}
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#3E1F5C' }]}
            onPress={() => router.push('/venta/nueva')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconCircleWhite}>
              <Feather name="plus" size={18} color="#3E1F5C" />
            </View>
            <View>
              <Text style={styles.actionBtnMainText}>Nueva venta</Text>
              <Text style={styles.actionBtnSubText}>Cobro rápido</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2E7655' }]}
            onPress={() => router.push('/venta/nueva')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconCircleWhite}>
              <Feather name="shopping-bag" size={18} color="#2E7655" />
            </View>
            <View>
              <Text style={styles.actionBtnMainText}>Cobrar venta</Text>
              <Text style={styles.actionBtnSubText}>Registrar salida</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnLight, { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }]}
            onPress={() => router.push('/(tabs)/inventario')}
            activeOpacity={0.85}
          >
            <Feather name="package" size={18} color="#6D28D9" style={{ marginRight: 10 }} />
            <Text style={[styles.actionBtnLightText, { color: '#6D28D9' }]}>Ver catálogo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnLight, { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]}
            onPress={() => router.push('/(tabs)/ventas')}
            activeOpacity={0.85}
          >
            <Feather name="grid" size={18} color="#C2410C" style={{ marginRight: 10 }} />
            <Text style={[styles.actionBtnLightText, { color: '#C2410C' }]}>Historial</Text>
          </TouchableOpacity>
        </View>

        {/* Sección de Catálogo Reciente */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos productos</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/inventario')} activeOpacity={0.7}>
            <Text style={styles.linkText}>Ver todos ({products.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.productList}>
          {ultimosProductos.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="sparkles-outline" size={28} color="#A78BFA" />
              </View>
              <Text style={styles.emptyTitle}>Tu catálogo está listo</Text>
              <Text style={styles.emptyText}>El catálogo se administra desde la aplicación Admin y se sincroniza aquí.</Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => router.push('/(tabs)/inventario')}
                activeOpacity={0.85}
              >
                <Feather name="package" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyAddBtnText}>Ver catálogo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            ultimosProductos.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.productCard}
                onPress={() => router.push({ pathname: '/venta/nueva', params: { productId: item.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.productImagePlaceholder}>
                  {item.image_uri ? (
                    <Image source={{ uri: item.image_uri }} style={styles.productImage} />
                  ) : (
                    <Ionicons name="sparkles" size={20} color="#C4B5FD" />
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productPrice}>${Number(item.price).toLocaleString('es-CL')}</Text>
                </View>
                <View style={styles.productStock}>
                  <View style={[
                    styles.stockPill,
                    Number(item.stock) === 0 ? styles.stockPillOut : Number(item.stock) <= 2 ? styles.stockPillLow : styles.stockPillOk
                  ]}>
                    <Text style={[
                      styles.stockPillText,
                      Number(item.stock) === 0 ? styles.stockTextOut : Number(item.stock) <= 2 ? styles.stockTextLow : styles.stockTextOk
                    ]}>
                      {Number(item.stock) === 0 ? 'Agotado' : `${item.stock} un.`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F3ED',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#3E1F5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#241536',
    letterSpacing: -0.3,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCard: {
    backgroundColor: '#3E1F5C',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroEyebrow: {
    color: '#E8D89F',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.6,
    marginTop: 8,
  },
  heroText: {
    color: '#EEE8F4',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 290,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  heroPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  heroPrimaryText: { color: '#3E1F5C', fontSize: 12, fontWeight: '800' },
  heroGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  heroGhostText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pendingList: { gap: 8, marginBottom: 20 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFDF9',
    borderColor: '#E3DBD1',
    borderWidth: 1,
    borderRadius: 15,
    padding: 11,
  },
  pendingIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  pendingIconRed: { backgroundColor: '#F9E8E8' },
  pendingIconGreen: { backgroundColor: '#E7F3EC' },
  pendingMain: { flex: 1 },
  pendingTitle: { color: '#241536', fontSize: 12, fontWeight: '800' },
  pendingText: { color: '#786F7D', fontSize: 10, marginTop: 2 },
  pendingCount: { color: '#A64242', fontSize: 14, fontWeight: '900' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#241536',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#786F7D',
    marginTop: 2,
    fontWeight: '500',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E3DBD1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    marginBottom: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#786F7D',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E3DBD1',
    borderLeftWidth: 4,
    boxShadow: '0px 1px 3px rgba(36, 21, 54, 0.04)',
    elevation: 1,
  },
  statIconBoxPurple: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEE7F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxGreen: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E7F3EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxIndigo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEE7F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxRed: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F9E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxGray: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F0EBE4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#786F7D',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#241536',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#241536',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 11,
    color: '#3E1F5C',
    fontWeight: '700',
  },
  sectionSubtitle: { fontSize: 11, color: '#786F7D', paddingHorizontal: 4 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionBtn: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    minHeight: 58,
    boxShadow: '0px 2px 4px rgba(36, 21, 54, 0.10)',
    elevation: 2,
  },
  actionIconCircleWhite: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFDF9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionBtnMainText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionBtnSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  actionBtnLight: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 10,
    minHeight: 48,
    borderWidth: 1,
  },
  actionBtnLightText: {
    fontSize: 13,
    fontWeight: '700',
  },
  productList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E3DBD1',
    boxShadow: '0px 1px 3px rgba(36, 21, 54, 0.03)',
    elevation: 1,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEE7F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3E1F5C',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E3DBD1',
  },
  productImagePlaceholder: {
    width: 46,
    height: 46,
    backgroundColor: '#F0EBE4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E3DBD1',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 13,
    color: '#3E1F5C',
    fontWeight: '800',
  },
  productStock: {
    alignItems: 'flex-end',
  },
  stockPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockPillOk: {
    backgroundColor: '#ECFDF5',
  },
  stockPillLow: {
    backgroundColor: '#FFFBEB',
  },
  stockPillOut: {
    backgroundColor: '#FEF2F2',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockTextOk: {
    color: '#065F46',
  },
  stockTextLow: {
    color: '#B45309',
  },
  stockTextOut: {
    color: '#991B1B',
  },
});
