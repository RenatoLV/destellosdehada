import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { processSyncQueue, getPendingSyncCount } from '../../sync/syncEngine';

export default function MasScreen() {
  const [pendientes, setPendientes] = useState<number>(0);
  const [sincronizando, setSincronizando] = useState<boolean>(false);

  // Cargar el número de operaciones pendientes al entrar a la pantalla
  const obtenerPendientes = async () => {
    try {
      const count = await getPendingSyncCount();
      setPendientes(count);
    } catch (error) {
      console.error("Error al obtener pendientes:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      obtenerPendientes();
    }, [])
  );

  // Ejecutar subida manual a Supabase
  const ejecutarSincronizacion = async () => {
    if (sincronizando) return;

    if (pendientes === 0) {
      Alert.alert("Todo al día", "No hay operaciones pendientes por subir a la nube.");
      return;
    }

    try {
      setSincronizando(true);
      const resultado = await processSyncQueue();
      await obtenerPendientes();

      if (resultado.success) {
        Alert.alert(
          "¡Sincronización Exitosa!", 
          `Se han subido ${resultado.processed} cambios correctamente a Supabase.`
        );
      } else {
        Alert.alert(
          "Sincronización incompleta", 
          `Se procesaron ${resultado.processed} cambios. Algunos reintentos quedaron pendientes. Revisa el log de Supabase.`
        );
      }
    } catch (error: any) {
      console.error("Error en sincronización manual:", error);
      Alert.alert(
        "Error de conexión", 
        "No se pudo conectar con Supabase. Verifica tu conexión a internet o los permisos RLS."
      );
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.headerTitle}>Más opciones</Text>
        <Text style={styles.headerSubtitle}>Gestión y configuración del sistema</Text>

        {/* TARJETA NUBE DE SINCRONIZACIÓN PRESIONABLE */}
        <TouchableOpacity 
          style={styles.syncCard} 
          onPress={ejecutarSincronizacion} 
          activeOpacity={0.8}
          disabled={sincronizando}
        >
          <View style={styles.syncIconContainer}>
            {sincronizando ? (
              <ActivityIndicator color="#D97706" />
            ) : (
              <Feather name={pendientes > 0 ? "cloud-off" : "cloud"} size={28} color="#D97706" />
            )}
          </View>
          <View style={styles.syncTextContainer}>
            <Text style={styles.syncTitle}>
              {sincronizando ? "Sincronizando..." : pendientes > 0 ? "Cambios guardados en tu celular" : "Sincronizado con la nube"}
            </Text>
            <Text style={styles.syncSubtitle}>
              {sincronizando 
                ? "Subiendo datos a Supabase..." 
                : pendientes > 0 
                  ? `${pendientes} operaciones pendientes. Toca para subir ahora.` 
                  : "Todos tus cambios están respaldados."
              }
            </Text>
          </View>
          <Feather name="refresh-cw" size={18} color="#D97706" />
        </TouchableOpacity>

        {/* ADMINISTRACIÓN */}
        <Text style={styles.sectionTitle}>Administración</Text>
        
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F5F3FF' }]}>
            <Feather name="grid" size={20} color="#7B5CF6" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Gestión de Categorías</Text>
            <Text style={styles.menuSubtitle}>Organiza joyas, accesorios y otros productos</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* AJUSTES Y AYUDA */}
        <Text style={styles.sectionTitle}>Ajustes y Ayuda</Text>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F8FAFC' }]}>
            <Feather name="settings" size={20} color="#64748B" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Configuración del Negocio</Text>
            <Text style={styles.menuSubtitle}>Ajustes generales de la aplicación</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F0F9FF' }]}>
            <Feather name="info" size={20} color="#0284C7" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Acerca de la app</Text>
            <Text style={styles.menuSubtitle}>Versión 2.0 • Offline-First</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 28,
  },
  syncIconContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  syncTextContainer: { flex: 1, marginHorizontal: 12 },
  syncTitle: { fontSize: 15, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  syncSubtitle: { fontSize: 12, color: '#B45309' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12, marginTop: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  menuIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuTextContainer: { flex: 1, marginHorizontal: 14 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  menuSubtitle: { fontSize: 12, color: '#64748B' },
});