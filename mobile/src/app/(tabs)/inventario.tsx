import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, TextInput, Image, ActivityIndicator 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useProducts } from '../../hooks/useProducts';

export default function InventarioScreen() {
  const router = useRouter();
  const { products, loading, refreshProducts } = useProducts();

  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');

  const categorias = ['Todos', 'Joyas', 'Accesorios', 'Otros'];

  // Recargar el inventario al enfocar la pestaña
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts])
  );

  // Filtrado por búsqueda y categoría
  const productosFiltrados = products.filter((producto) => {
    const coincideNombre = producto.name.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = categoriaActiva === 'Todos' || producto.category_id === categoriaActiva;
    return coincideNombre && coincideCategoria;
  });

  const getStockBadge = (stock: number) => {
    if (stock <= 0) {
      return { text: 'Agotado', bg: '#FEE2E2', color: '#DC2626' };
    }
    if (stock <= 2) {
      return { text: 'Stock bajo', bg: '#FEF3C7', color: '#D97706' };
    }
    return { text: 'En stock', bg: '#DCFCE7', color: '#16A34A' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabecera */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventario</Text>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Buscar producto..."
          placeholderTextColor="#94A3B8"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Feather name="x" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros de Categorías */}
      <View style={{ height: 44, marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {categorias.map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.chip, categoriaActiva === cat && styles.chipActive]}
              onPress={() => setCategoriaActiva(cat)}
            >
              <Text style={[styles.chipText, categoriaActiva === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de Productos */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7B5CF6" />
        </View>
      ) : productosFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="box" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {busqueda ? 'Sin resultados' : 'Tu inventario está vacío'}
          </Text>
          <Text style={styles.emptySub}>
            {busqueda ? 'No se encontraron productos con ese nombre.' : 'Agrega tu primer producto para comenzar.'}
          </Text>
          {!busqueda && (
            <TouchableOpacity 
              style={styles.addFirstBtn}
              onPress={() => router.push('/producto/nuevo')}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.addFirstBtnText}>Agregar producto</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {productosFiltrados.map((producto) => {
            const badge = getStockBadge(producto.stock);
            const precioFormatted = Number(producto.price).toLocaleString('es-CL');

            return (
              <TouchableOpacity 
                key={producto.id} 
                style={styles.productCard}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/producto/[id]', params: { id: producto.id } })}
              >
                {/* Imagen */}
                <View style={styles.imageBox}>
                  {producto.image_uri ? (
                    <Image source={{ uri: producto.image_uri }} style={styles.image} />
                  ) : (
                    <Feather name="image" size={24} color="#94A3B8" />
                  )}
                </View>

                {/* Info */}
                <View style={styles.infoBox}>
                  <Text style={styles.productName} numberOfLines={1}>{producto.name}</Text>
                  <Text style={styles.categoryText}>{producto.category_id || 'Joyas'}</Text>
                  <Text style={styles.priceText}>${precioFormatted}</Text>
                </View>

                {/* Stock Badge */}
                <View style={styles.stockColumn}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                  <Text style={styles.stockText}>Stock: {producto.stock}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Botón Flotante para Agregar */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.fabBtn}
          onPress={() => router.push('/producto/nuevo')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.fabBtnText}>Agregar producto</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', marginHorizontal: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  chip: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, height: 36, justifyContent: 'center' },
  chipActive: { backgroundColor: '#7B5CF6' },
  chipText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  listContainer: { paddingHorizontal: 20 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  imageBox: { width: 68, height: 68, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  image: { width: '100%', height: '100%' },
  infoBox: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  categoryText: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  priceText: { fontSize: 16, fontWeight: '800', color: '#7B5CF6' },
  stockColumn: { alignItems: 'flex-end', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  stockText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7B5CF6', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  addFirstBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  fabBtn: { backgroundColor: '#7B5CF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  fabBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});