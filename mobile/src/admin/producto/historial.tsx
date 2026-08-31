import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { getProductMovementsLocal } from '../../database/inventory';
import { useProducts } from '../../hooks/useProducts';

export default function HistorialProductoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products } = useProducts();
  const producto = products.find((p) => String(p.id) === String(id));

  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarHistorial() {
      if (id) {
        try {
          const historial = await getProductMovementsLocal(id);
          setMovimientos(historial);
        } catch (error) {
          console.error("Error al cargar historial:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    cargarHistorial();
  }, [id]);

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'SALE': return { icon: 'shopping-bag', color: '#EF4444', label: 'Venta' };
      case 'INITIAL_STOCK': return { icon: 'plus-circle', color: '#22C55E', label: 'Inventario Inicial' };
      case 'PURCHASE': return { icon: 'package', color: '#3B82F6', label: 'Compra' };
      case 'RETURN': return { icon: 'rotate-ccw', color: '#8B5CF6', label: 'Devolución' };
      case 'ADJUSTMENT': return { icon: 'edit-3', color: '#F59E0B', label: 'Ajuste Manual' };
      default: return { icon: 'box', color: '#64748B', label: type };
    }
  };

  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-CL', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.header}>
          <Text style={styles.title}>{producto?.name || 'Producto'}</Text>
          <Text style={styles.subtitle}>Historial de movimientos de inventario</Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7B5CF6" />
          </View>
        ) : movimientos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="clock" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>No hay movimientos registrados para este producto.</Text>
          </View>
        ) : (
          movimientos.map((item) => {
            const ui = getIconAndColor(item.type);
            const isPositivo = item.quantity > 0;
            const prefijo = isPositivo ? '+' : '';

            return (
              <View key={item.id} style={styles.card}>
                <View style={[styles.iconBg, { backgroundColor: ui.color + '18' }]}>
                  <Feather name={ui.icon as any} size={20} color={ui.color} />
                </View>
                
                <View style={styles.info}>
                  <Text style={styles.tipoText}>{ui.label}</Text>
                  {item.reason ? <Text style={styles.motivoText}>{item.reason}</Text> : null}
                  <Text style={styles.fechaText}>{formatearFecha(item.created_at)}</Text>
                </View>
                
                <View style={styles.stockCol}>
                  <Text style={[styles.qtyText, { color: ui.color }]}>
                    {prefijo}{item.quantity}
                  </Text>
                  <Text style={styles.stockText}>Stock: {item.stock_before} → {item.stock_after}</Text>
                </View>
              </View>
            );
          })
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  centerContainer: { padding: 40, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  iconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  tipoText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  motivoText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  fechaText: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  stockCol: { alignItems: 'flex-end', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '800' },
  stockText: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '500' },
});