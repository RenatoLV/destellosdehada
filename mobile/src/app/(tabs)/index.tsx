import React, { useMemo, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  ScrollView, ActivityIndicator, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';

export default function HomeScreen() {
  const router = useRouter();
  const { products, loading: loadingProducts, refreshProducts } = useProducts();
  const { sales, loading: loadingSales, refreshSales } = useSales();

  // Recargar métricas al enfocarse en la pestaña de Inicio
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
      refreshSales();
    }, [refreshProducts, refreshSales])
  );

  // --- CÁLCULO DE MÉTRICAS EN TIEMPO REAL ---
  const metricas = useMemo(() => {
    // 1. Total de productos activos
    const totalProductos = products.length;

    // 2. Productos con stock bajo (<= 2 unidades)
    const stockBajo = products.filter(p => Number(p.stock) <= 2).length;

    // 3. Valor total del inventario (Precio * Stock)
    const valorInventario = products.reduce((acc, p) => acc + (Number(p.price) * Number(p.stock)), 0);

    // 4. Ventas de hoy
    const hoyStr = new Date().toISOString().split('T')[0];
    const ventasHoyLista = sales.filter(s => {
      if (!s.created_at) return false;
      const fechaVenta = new Date(s.created_at).toISOString().split('T')[0];
      return fechaVenta === hoyStr;
    });

    const ventasHoyCount = ventasHoyLista.length;

    return {
      totalProductos,
      stockBajo,
      valorInventario,
      ventasHoyCount,
    };
  }, [products, sales]);

  // Últimos 3 productos agregados
  const ultimosProductos = useMemo(() => {
    return products.slice(0, 3);
  }, [products]);

  const isLoading = loadingProducts || loadingSales;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>¡Hola, Mamá! 👋</Text>
            <Text style={styles.subtitle}>Aquí tienes el resumen de tu negocio</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => router.push('/(tabs)/mas')}
            activeOpacity={0.7}
          >
            <Feather name="settings" size={22} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* Carga de datos */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#7B5CF6" />
            <Text style={styles.loadingText}>Actualizando métricas...</Text>
          </View>
        ) : (
          /* Tarjetas de Resumen (Grid 2x2 con datos reales de SQLite) */
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total productos</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>{metricas.totalProductos}</Text>
                <Feather name="box" size={20} color="#7B5CF6" />
              </View>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Ventas hoy</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>{metricas.ventasHoyCount}</Text>
                <Feather name="trending-up" size={20} color="#22C55E" />
              </View>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Valor inventario</Text>
              <View style={styles.statRow}>
                <Text style={styles.statValue}>${metricas.valorInventario.toLocaleString('es-CL')}</Text>
                <Feather name="dollar-sign" size={20} color="#7B5CF6" />
              </View>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Stock bajo</Text>
              <View style={styles.statRow}>
                <Text style={[styles.statValue, metricas.stockBajo > 0 && { color: '#EF4444' }]}>
                  {metricas.stockBajo}
                </Text>
                <Feather name="alert-triangle" size={20} color={metricas.stockBajo > 0 ? "#EF4444" : "#94A3B8"} />
              </View>
            </View>
          </View>
        )}

        {/* Acciones Rápidas Táctiles (Botones Grandes) */}
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#7B5CF6' }]}
            onPress={() => router.push('/producto/nuevo')}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={20} color="#FFFFFF" style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Agregar producto</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]}
            onPress={() => router.push('/venta/nueva')}
            activeOpacity={0.85}
          >
            <Feather name="shopping-bag" size={20} color="#166534" style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: '#166534' }]}>Registrar venta</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#EDE9FE' }]}
            onPress={() => router.push('/(tabs)/inventario')}
            activeOpacity={0.85}
          >
            <Feather name="package" size={20} color="#5B21B6" style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: '#5B21B6' }]}>Ver inventario</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#FFEDD5' }]}
            onPress={() => router.push('/categorias' as any)}
            activeOpacity={0.85}
          >
            <Feather name="grid" size={20} color="#9A3412" style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: '#9A3412' }]}>Categorías</Text>
          </TouchableOpacity>
        </View>

        {/* Sección de Últimos Productos Agregados */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos productos agregados</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/inventario')}>
            <Text style={styles.linkText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {/* Lista en tiempo real de SQLite */}
        <View style={styles.productList}>
          {ultimosProductos.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={32} color="#CBD5E1" />
              <Text style={styles.emptyText}>Aún no has ingresado productos</Text>
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
                    <Feather name="image" size={22} color="#9CA3AF" />
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productPrice}>${Number(item.price).toLocaleString('es-CL')}</Text>
                </View>
                <View style={styles.productStock}>
                  <Text style={styles.stockLabel}>Stock</Text>
                  <Text style={[
                    styles.stockValueNumber, 
                    Number(item.stock) <= 2 && { color: '#EF4444' }
                  ]}>
                    {item.stock}
                  </Text>
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
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  settingsBtn: {
    padding: 8,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
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
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#7B5CF6',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    minHeight: 52,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  productList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 14,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productImagePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 13,
    color: '#7B5CF6',
    fontWeight: '700',
  },
  productStock: {
    alignItems: 'flex-end',
  },
  stockLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  stockValueNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
});