import React, { useCallback } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, Image, ActivityIndicator 
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProducts } from '../../hooks/useProducts';

export default function DetalleProductoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { products, loading, refreshProducts } = useProducts();

  // Recargar datos al volver a esta pantalla
  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts])
  );

  // Buscar el producto real en SQLite usando el ID de la ruta
  const producto = products.find((p) => String(p.id) === String(id));

  // ESTADO 1: Cargando base de datos
  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7B5CF6" />
        <Text style={styles.loadingText}>Cargando detalle del producto...</Text>
      </SafeAreaView>
    );
  }

  // ESTADO 2: Producto no encontrado o eliminado
  if (!producto) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Feather name="alert-circle" size={48} color="#94A3B8" />
        <Text style={styles.notFoundTitle}>Producto no encontrado</Text>
        <Text style={styles.notFoundSub}>El producto seleccionado no existe o fue removido.</Text>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>Volver al inventario</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Configuración del Badge de Stock
  const getStockBadge = () => {
    if (producto.stock === 0) {
      return { text: 'Agotado', bg: '#FEE2E2', color: '#991B1B' };
    }
    if (producto.stock <= 2) {
      return { text: 'Stock bajo', bg: '#FEF3C7', color: '#92400E' };
    }
    return { text: 'En stock', bg: '#DCFCE7', color: '#166534' };
  };

  const badge = getStockBadge();
  const precioVenta = Math.round(Number(producto.price)) || 0;
  const costoProducto = Math.round(Number(producto.cost)) || 0;
  const fechaCreacion = producto.created_at 
    ? new Date(producto.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Reciente';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Imagen Real del Producto / Placeholder */}
        <View style={styles.imageContainer}>
          {producto.image_uri ? (
            <Image source={{ uri: producto.image_uri }} style={styles.productImage} />
          ) : (
            <Feather name="image" size={56} color="#9CA3AF" />
          )}
        </View>

        {/* Header: Nombre y Estado */}
        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.productName}>{producto.name}</Text>
            <View style={[styles.badgeWrapper, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          </View>
          <Text style={styles.categoryText}>
            {producto.category_id || 'Joyas'} • {producto.type || 'General'}
          </Text>
        </View>

        {/* Tarjetas Principales (Precio y Stock) */}
        <View style={styles.mainStatsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Precio de venta</Text>
            <Text style={styles.statValue}>${precioVenta.toLocaleString('es-CL')}</Text>
          </View>
          
          <View style={[styles.statBox, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
             <Text style={styles.statLabel}>Stock actual</Text>
             <Text style={[styles.statValue, { color: '#0F172A' }]}>{producto.stock} unidades</Text>
          </View>
        </View>

        {/* Información Técnica del Producto */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Información del producto</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Costo</Text>
            <Text style={styles.infoValue}>
              {costoProducto > 0 ? `$${costoProducto.toLocaleString('es-CL')}` : 'Sin costo registrado'}
            </Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Código / SKU</Text>
            <Text style={styles.infoValue}>{producto.sku || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Proveedor</Text>
            <Text style={styles.infoValue}>{producto.supplier || 'No especificado'}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de registro</Text>
            <Text style={styles.infoValue}>{fechaCreacion}</Text>
          </View>
        </View>

        {/* Descripción del producto (si existe) */}
        {producto.description ? (
          <View style={[styles.infoCard, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.descriptionText}>{producto.description}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* Botones Flotantes Inferiores */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/producto/editar', params: { id: producto.id } })}
          >
            <Feather name="edit-2" size={20} color="#475569" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.primaryBtn, producto.stock === 0 && { backgroundColor: '#94A3B8' }]} 
            activeOpacity={0.8}
            disabled={producto.stock === 0}
            onPress={() => router.push({ pathname: '/venta/nueva', params: { productId: producto.id } })}
          >
            <Feather name="shopping-bag" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>
              {producto.stock === 0 ? 'Sin stock' : 'Vender'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Enlace al historial */}
        <TouchableOpacity 
          style={styles.historyLink}
          onPress={() => router.push({ pathname: '/producto/historial', params: { id: producto.id } })}
        >
          <Feather name="clock" size={16} color="#7B5CF6" style={{ marginRight: 6 }} />
          <Text style={styles.historyText}>Ver historial de movimientos</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 15,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
  },
  notFoundSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#7B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  scrollContent: {
    paddingBottom: 150,
  },
  imageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerInfo: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 12,
  },
  badgeWrapper: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  mainStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#7B5CF6',
  },
  infoCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  descriptionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  primaryBtn: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: '#7B5CF6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#7B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyText: {
    fontSize: 14,
    color: '#7B5CF6',
    fontWeight: '600',
  },
});