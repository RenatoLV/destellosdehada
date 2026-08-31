import React from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSync } from '../../sync/useSync';
import { supabase } from '../../services/supabase';

export default function MasScreen() {
  const router = useRouter();
  const { isOnline, isSyncing, pendingCount, lastSyncTime, lastError, syncNow } = useSync();

  const ejecutarSincronizacion = async () => {
    if (isSyncing) return;

    if (!isOnline) {
      Alert.alert(
        "Sin conexión a internet",
        "Tu dispositivo está en modo local (SQLite). Tus datos están seguros en el teléfono y se subirán automáticamente a Supabase cuando vuelva internet."
      );
      return;
    }

    try {
      const resultado = await syncNow();
      if (resultado.success) {
        Alert.alert(
          "¡Sincronización Exitosa! ✨",
          `• Cambios locales subidos: ${resultado.processed}\n• Datos remotos descargados: ${resultado.pulled}\n\nTodo el catálogo está al día.`
        );
      } else {
        Alert.alert(
          "Aviso de sincronización",
          `Se procesaron ${resultado.processed} cambios. Algunos reintentos quedaron en cola para el próximo ciclo.`
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se pudo sincronizar.";
      Alert.alert("Error", message);
    }
  };

  const cerrarSesion = () => {
    Alert.alert(
      "Cerrar sesión",
      "¿Seguro que deseas salir de tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Salir", 
          style: "destructive", 
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ajustes y Nube ✨</Text>
          <Text style={styles.headerSubtitle}>Destellos de Hada • Gestión del sistema</Text>
        </View>

        {/* TARJETA MAESTRA DE SINCRONIZACIÓN SUPABASE */}
        <View style={styles.syncCard}>
          <View style={styles.syncHeaderRow}>
            <View style={[styles.syncStatusCircle, !isOnline ? styles.bgRed : isSyncing ? styles.bgPurple : pendingCount > 0 ? styles.bgAmber : styles.bgGreen]}>
              <Ionicons 
                name={isSyncing ? "sync" : !isOnline ? "cloud-offline" : pendingCount > 0 ? "cloud-upload" : "cloud-done"} 
                size={22} 
                color={!isOnline ? "#DC2626" : isSyncing ? "#7B5CF6" : pendingCount > 0 ? "#D97706" : "#059669"} 
              />
            </View>
            <View style={styles.syncHeaderInfo}>
              <Text style={styles.syncStateTitle}>
                {isSyncing 
                  ? "Sincronizando con Supabase..." 
                  : !isOnline 
                    ? "Modo Offline (Almacenamiento Local)" 
                    : pendingCount > 0 
                      ? `${pendingCount} cambio${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}` 
                      : "Supabase Conectado y Al Día"}
              </Text>
              <Text style={styles.syncStateSub}>
                {lastSyncTime ? `Última sincronización: ${lastSyncTime}` : 'Conexión bidireccional activa'}
              </Text>
            </View>
          </View>

          {/* Botón de Acción Manual */}
          <TouchableOpacity 
            style={[styles.syncActionBtn, isSyncing && styles.btnDisabled]} 
            onPress={ejecutarSincronizacion} 
            activeOpacity={0.8}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#7B5CF6" style={{ marginRight: 8 }} />
            ) : (
              <Feather name="refresh-cw" size={16} color="#7B5CF6" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.syncActionBtnText}>
              {isSyncing ? "Sincronizando..." : "Forzar sincronización ahora"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* OPERACIÓN */}
        <Text style={styles.sectionTitle}>Operación</Text>

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.75}
          onPress={() => router.push('/(tabs)/ventas')}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#F5F3FF' }]}>
            <Feather name="shopping-bag" size={20} color="#7B5CF6" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Historial de ventas</Text>
            <Text style={styles.menuSubtitle}>Consulta cobros y estados de sincronización</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#CBD5E1" />
        </TouchableOpacity>

        <View style={styles.menuItem}>
          <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="database" size={20} color="#2563EB" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Base de Datos Híbrida</Text>
            <Text style={styles.menuSubtitle}>SQLite local (rápido) + Supabase (respaldo)</Text>
          </View>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v2.0</Text>
          </View>
        </View>

        {/* CERRAR SESIÓN */}
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={cerrarSesion}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16, paddingHorizontal: 4 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
  syncCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    boxShadow: '0px 1px 3px rgba(36, 21, 54, 0.03)',
    elevation: 1,
  },
  syncHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  syncStatusCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12,
  },
  bgGreen: { backgroundColor: '#ECFDF5' },
  bgRed: { backgroundColor: '#FEF2F2' },
  bgPurple: { backgroundColor: '#F5F3FF' },
  bgAmber: { backgroundColor: '#FFFBEB' },
  syncHeaderInfo: { flex: 1 },
  syncStateTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  syncStateSub: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  syncActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  btnDisabled: { opacity: 0.6 },
  syncActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7B5CF6',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingHorizontal: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuTextContainer: { flex: 1, marginHorizontal: 12 },
  menuTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  menuSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  versionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
