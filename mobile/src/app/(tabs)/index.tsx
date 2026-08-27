import React, { useMemo, useCallback, useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  ScrollView, ActivityIndicator, Image, RefreshControl 
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
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing || isSyncing} 
            onRefresh={onRefresh} 
            tintColor="#7B5CF6"
            colors={['#7B5CF6']}
          />
        }
      >
        {/* Barra superior de estado y marca */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.sparkleIcon}>
              <Ionicons name="sparkles" size={18} color="#7B5CF6" />
            </View>
            <Text style={styles.brandName}>Destellos de Hada</Text>
          </View>
          <SyncBadge variant="pill" />
        </View>

        {/* Header de Saludo */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingTitle}>¡Hola! ✨</Text>
            <Text style={styles.greetingSubtitle}>Resumen de tu joyería y catálogo</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => router.push('/(tabs)/mas')}
            activeOpacity={0.7}
          >
            <Feather name="settings" size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Tarjetas de Resumen (Grid 2x2) */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#7B5CF6" />
            <Text style={styles.loadingText}>Cargando inventario local...</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderLeftColor: '#7B5CF6' }]}>
              <View style={styles.statIconBoxPurple}>
                <Feather name="box" size={16} color="#7B5CF6" />
              </View>
              <Text style={styles.statLabel}>Productos</Text>
              <Text style={styles.statValue}>{metricas.totalProductos}</Text>
            </View>
            
            <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
              <View style={styles.statIconBoxGreen}>
                <Feather name="trending-up" size={16} color="#10B981" />
              </View>
              <Text style={styles.statLabel}>Ventas hoy</Text>
              <Text style={styles.statValue}>
                {metricas.ventasHoyCount} {metricas.ventasHoyTotal > 0 ? `(\$${metricas.ventasHoyTotal.toLocaleString('es-CL')})` : ''}
              </Text>
            </View>
            
            <View style={[styles.statCard, { borderLeftColor: '#6366F1' }]}>
              <View style={styles.statIconBoxIndigo}>
                <Feather name="dollar-sign" size={16} color="#6366F1" />
              </View>
              <Text style={styles.statLabel}>Valor catálogo</Text>
              <Text style={styles.statValue}>${metricas.valorInventario.toLocaleString('es-CL')}</Text>
            </View>
            
            <View style={[styles.statCard, { borderLeftColor: metricas.stockBajo > 0 ? '#EF4444' : '#E2E8F0' }]}>
              <View style={metricas.stockBajo > 0 ? styles.statIconBoxRed : styles.statIconBoxGray}>
                <Feather name="alert-triangle" size={16} color={metricas.stockBajo > 0 ? "#EF4444" : "#94A3B8"} />
              </View>
              <Text style={styles.statLabel}>Stock bajo</Text>
              <Text style={[styles.statValue, metricas.stockBajo > 0 && { color: '#EF4444' }]}>
                {metricas.stockBajo}
              </Text>
            </View>
          </View>
        )}

        {/* Acciones Rápidas Táctiles (Mobile Friendly) */}
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#7B5CF6' }]}
            onPress={() => router.push('/producto/nuevo')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconCircleWhite}>
              <Feather name="plus" size={18} color="#7B5CF6" />
            </View>
            <View>
              <Text style={styles.actionBtnMainText}>Nuevo producto</Text>
              <Text style={styles.actionBtnSubText}>Foto y precio</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/venta/nueva')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconCircleWhite}>
              <Feather name="shopping-bag" size={18} color="#10B981" />
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
            onPress={() => router.push('/categorias' as any)}
            activeOpacity={0.85}
          >
            <Feather name="grid" size={18} color="#C2410C" style={{ marginRight: 10 }} />
            <Text style={[styles.actionBtnLightText, { color: '#C2410C' }]}>Categorías</Text>
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
              <Text style={styles.emptyText}>Agrega tus primeras joyas para empezar a gestionar tu stock.</Text>
              <TouchableOpacity 
                style={styles.emptyAddBtn}
                onPress={() => router.push('/producto/nuevo')}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyAddBtnText}>Crear producto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            ultimosProductos.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.productCard}
                onPress={() => router.push({ pathname: '/producto/[id]', params: { id: item.id } })}
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
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
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
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#64748B',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconBoxPurple: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxGreen: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxIndigo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxRed: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxGray: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 13,
    color: '#7B5CF6',
    fontWeight: '700',
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconCircleWhite: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
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
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
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
    backgroundColor: '#F5F3FF',
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
    backgroundColor: '#7B5CF6',
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
    borderBottomColor: '#F1F5F9',
  },
  productImagePlaceholder: {
    width: 46,
    height: 46,
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3E8FF',
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
    color: '#7B5CF6',
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
