import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, Image, ActivityIndicator, Alert 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getDeletedProductsLocal, restoreProductLocal } from '../../database/products';

export default function ConfiguracionScreen() {
  const [productosEliminados, setProductosEliminados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarPapelera = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDeletedProductsLocal();
      setProductosEliminados(data);
    } catch (error) {
      console.error("Error al cargar la papelera:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarPapelera();
    }, [cargarPapelera])
  );

  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleRestaurar = (id: string, nombre: string) => {
    Alert.alert(
      "Restaurar producto",
      `¿Deseas devolver "${nombre}" a tu inventario activo?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Restaurar", 
          onPress: async () => {
            try {
              await restoreProductLocal(id);
              Alert.alert("¡Restaurado!", "El producto vuelve a estar disponible en tu catálogo.");
              cargarPapelera(); // Recargar la lista
            } catch (error) {
              Alert.alert("Error", "No se pudo restaurar el producto.");
            }
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Cabecera de Configuración */}
        <View style={styles.header}>
          <Text style={styles.title}>Configuración</Text>
          <Text style={styles.subtitle}>Ajustes y papelera de reciclaje</Text>
        </View>

        {/* Sección Papelera de Reciclaje */}
        <View style={styles.sectionHeader}>
          <Feather name="trash-2" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>Papelera de productos</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Los productos que elimines aparecerán aquí. No se borran definitivamente para proteger tu historial de ventas.
        </Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7B5CF6" />
          </View>
        ) : productosEliminados.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBg}>
              <Feather name="check" size={24} color="#16A34A" />
            </View>
            <Text style={styles.emptyText}>La papelera está vacía.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {productosEliminados.map((producto, index) => (
              <View 
                key={producto.id} 
                style={[
                  styles.itemRow, 
                  index === productosEliminados.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={styles.imageBox}>
                  {producto.image_uri ? (
                    <Image source={{ uri: producto.image_uri }} style={styles.productImage} />
                  ) : (
                    <Feather name="image" size={20} color="#94A3B8" />
                  )}
                </View>
                
                <View style={styles.infoBox}>
                  <Text style={styles.productName} numberOfLines={1}>{producto.name}</Text>
                  <Text style={styles.deletedDate}>Eliminado el {formatearFecha(producto.deleted_at)}</Text>
                </View>

                <TouchableOpacity 
                  style={styles.restoreBtn}
                  onPress={() => handleRestaurar(producto.id, producto.name)}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-ccw" size={16} color="#7B5CF6" style={{ marginRight: 6 }} />
                  <Text style={styles.restoreBtnText}>Restaurar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  sectionDesc: { fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 20 },
  centerContainer: { padding: 40, alignItems: 'center' },
  emptyCard: { padding: 32, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  imageBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  infoBox: { flex: 1, marginRight: 10 },
  productName: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  deletedDate: { fontSize: 12, color: '#EF4444', fontWeight: '500' },
  restoreBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE' },
  restoreBtnText: { fontSize: 13, fontWeight: '700', color: '#7B5CF6' },
});