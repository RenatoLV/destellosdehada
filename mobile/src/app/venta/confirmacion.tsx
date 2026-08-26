import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function ConfirmacionVentaScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* Círculo Animado de Éxito */}
        <View style={styles.successCircle}>
          <Feather name="check" size={56} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>¡Venta registrada!</Text>
        <Text style={styles.subtitle}>
          El stock del producto se ha actualizado correctamente en el almacenamiento local.
        </Text>

        {/* Acciones Siguientes */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.primaryBtn}
            onPress={() => router.replace('/venta/nueva')}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Registrar otra venta</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(tabs)/inventario')}
            activeOpacity={0.85}
          >
            <Feather name="package" size={20} color="#475569" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Volver al inventario</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 24, elevation: 4, shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 36, lineHeight: 22 },
  actionsContainer: { width: '100%', gap: 12 },
  primaryBtn: { flexDirection: 'row', backgroundColor: '#7B5CF6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#475569', fontSize: 16, fontWeight: '700' },
});