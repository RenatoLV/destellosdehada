import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, FlatList, useWindowDimensions,
  TouchableOpacity, TextInput, Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useProducts } from '../../hooks/useProducts';
import { useSync } from '../../sync/useSync';
import { SyncBadge } from '../../components/SyncBadge';

export default function InventarioScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = width < 360 ? 12 : 16;
  const { products, loading, refreshProducts } = useProducts();
  const { syncNow, isSyncing } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');

  const categorias = ['Todos', 'Joyas', 'Accesorios', 'Anillos', 'Collares', 'Otros'];

  // Recargar el inventario al enfocar la pestaña
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await refreshProducts();
    setRefreshing(false);
  };

  // Filtrado por búsqueda y categoría
  const productosFiltrados = products.filter((producto) => {
    const coincideNombre = (producto.name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (producto.sku || '').toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = categoriaActiva === 'Todos' || producto.category_id === categoriaActiva;
    return coincideNombre && coincideCategoria;
  });

  const getStockBadge = (stock: number) => {
    if (stock <= 0) {
      return { text: 'Agotado', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
    }
    if (stock <= 2) {
      return { text: `${stock} en stock (Bajo)`, bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
    }
    return { text: `${stock} en stock`, bg: '#ECFDF5', color: '#16A34A', border: '#A7F3D0' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabecera con SyncBadge */}
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <View>
          <Text style={styles.title}>Catálogo ✨</Text>
          <Text style={styles.subtitle}>{products.length} productos registrados</Text>
        </View>
        <SyncBadge variant="pill" />
      </View>

      {/* Buscador Rápido */}
      <View style={[styles.searchContainer, { marginHorizontal: horizontalPadding }]}>
        <Feather name="search" size={18} color="#7B5CF6" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, código o SKU..."
          placeholderTextColor="#94A3B8"
          value={busqueda}
          onChangeText={setBusqueda}
          clearButtonMode="while-editing"
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')} style={styles.clearBtn}>
            <Feather name="x" size={14} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros de Categorías */}
      <View style={{ height: 42, marginBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: horizontalPadding }}
        >
          {categorias.map((cat) => {
            const count = cat === 'Todos'
              ? products.length
              : products.filter(p => p.category_id === cat).length;
            const isSelected = categoriaActiva === cat;

            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setCategoriaActiva(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {cat}
                </Text>
                {count > 0 && (
                  <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                    <Text style={[styles.countText, isSelected && styles.countTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lista de Productos con Pull-to-Refresh */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3E1F5C" />
          <Text style={styles.loadingText}>Cargando catálogo...</Text>
        </View>
      ) : productosFiltrados.length === 0 ? (
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
              <Ionicons name="sparkles-outline" size={36} color="#A78BFA" />
            </View>
            <Text style={styles.emptyTitle}>
              {busqueda ? 'Sin coincidencias' : 'Catálogo vacío'}
            </Text>
            <Text style={styles.emptySub}>
              {busqueda
                ? `No encontramos productos con "${busqueda}".`
                : 'El catálogo se administra desde Admin y aparecerá aquí al sincronizar.'}
            </Text>
            {!busqueda && (
              <TouchableOpacity
                style={styles.addFirstBtn}
                onPress={() => router.push('/(tabs)/mas')}
                activeOpacity={0.85}
              >
                <Feather name="refresh-cw" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.addFirstBtnText}>Revisar sincronización</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={productosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={({ item: producto }) => {
            const badge = getStockBadge(Number(producto.stock || 0));
            const precioFormatted = Number(producto.price || 0).toLocaleString('es-CL');

            return (
              <TouchableOpacity
                style={styles.productCard}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: '/venta/nueva', params: { productId: producto.id } })}
              >
                <View style={styles.imageBox}>
                  {producto.image_uri ? <Image source={{ uri: producto.image_uri }} style={styles.image} /> : <Ionicons name="sparkles" size={22} color="#C4B5FD" />}
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.productName} numberOfLines={1}>{producto.name}</Text>
                  <Text style={styles.categoryText}>{producto.category_id || 'Joyería'}</Text>
                  <Text style={styles.priceText}>${precioFormatted}</Text>
                </View>
                <View style={styles.stockColumn}>
                  <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}><Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text></View>
                  <Feather name="chevron-right" size={16} color="#CBD5E1" style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={<View style={{ height: 90 }} />}
          contentContainerStyle={{ paddingHorizontal: horizontalPadding }}
          style={[styles.listContainer, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isSyncing}
              onRefresh={onRefresh}
            tintColor="#3E1F5C"
            />
          }
        />
      )}

      {/* Acción principal del POS */}
      <View style={[styles.footer, { paddingHorizontal: horizontalPadding, paddingBottom: Math.max(12, insets.bottom) }]}>
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => router.push('/venta/nueva')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.fabBtnText}>Nueva venta</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3DBD1',
    marginBottom: 12,
    boxShadow: '0px 1px 2px rgba(36, 21, 54, 0.02)',
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 2 },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    height: 34,
    borderWidth: 1,
    borderColor: '#E3DBD1',
  },
  chipActive: {
    backgroundColor: '#3E1F5C',
    borderColor: '#3E1F5C',
  },
  chipText: { color: '#786F7D', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  countBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  countTextActive: {
    color: '#FFFFFF',
  },
  listContainer: { paddingHorizontal: 16 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E3DBD1',
    boxShadow: '0px 1px 3px rgba(36, 21, 54, 0.03)',
    elevation: 1,
  },
  imageBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#FAF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3E8FF'
  },
  image: { width: '100%', height: '100%' },
  infoBox: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '800', color: '#241536', marginBottom: 2 },
  categoryText: { fontSize: 12, color: '#786F7D', marginBottom: 4, fontWeight: '500' },
  priceText: { fontSize: 15, fontWeight: '800', color: '#3E1F5C' },
  stockColumn: { alignItems: 'flex-end', justifyContent: 'center' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748B', fontSize: 13 },
  emptyScroll: { flexGrow: 1, justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', padding: 32 },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3E1F5C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14
  },
  addFirstBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
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
    backgroundColor: '#7B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    boxShadow: '0px 4px 6px rgba(62, 31, 92, 0.30)',
    elevation: 3,
  },
  fabBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
