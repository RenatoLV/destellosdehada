import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, TextInput, Alert, ActivityIndicator 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getCategoriesLocal, addCategoryLocal } from '../../database/categories';
import { Category } from '../../types/database';

export default function CategoriasScreen() {
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarCategorias = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCategoriesLocal();
      setCategorias(data);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarCategorias();
    }, [cargarCategorias])
  );

  const handleAgregarCategoria = async () => {
    if (!nuevaCategoria.trim()) {
      Alert.alert("Nombre requerido", "Por favor ingresa un nombre para la categoría.");
      return;
    }

    try {
      setGuardando(true);
      await addCategoryLocal(nuevaCategoria.trim());
      setNuevaCategoria('');
      await cargarCategorias();
    } catch (error) {
      console.error("Error al crear categoría:", error);
      Alert.alert("Error", "No se pudo guardar la categoría en SQLite.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Categorías</Text>
          <Text style={styles.subtitle}>Organiza tu catálogo por tipo de producto</Text>
        </View>

        {/* Crear Nueva Categoría */}
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Agregar nueva categoría</Text>
          <View style={styles.inputRow}>
            <TextInput 
              style={styles.input}
              placeholder="Ej. Anillos, Pulseras, Billeteras..."
              placeholderTextColor="#94A3B8"
              value={nuevaCategoria}
              onChangeText={setNuevaCategoria}
            />
            <TouchableOpacity 
              style={[styles.addBtn, guardando && { opacity: 0.7 }]}
              onPress={handleAgregarCategoria}
              disabled={guardando}
              activeOpacity={0.8}
            >
              {guardando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Feather name="plus" size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista de Categorías */}
        <Text style={styles.sectionTitle}>Categorías registradas</Text>
        
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7B5CF6" />
          </View>
        ) : categorias.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="grid" size={32} color="#CBD5E1" />
            <Text style={styles.emptyText}>No hay categorías personalizadas aún.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {categorias.map((cat, index) => (
              <View 
                key={cat.id} 
                style={[
                  styles.itemRow, 
                  index === categorias.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={styles.catIconCircle}>
                  <Feather name="folder" size={18} color="#7B5CF6" />
                </View>
                <Text style={styles.catName}>{cat.name}</Text>
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
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 2 },
  createCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  createTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
  addBtn: { width: 48, height: 48, backgroundColor: '#7B5CF6', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  centerContainer: { padding: 40, alignItems: 'center' },
  emptyCard: { padding: 32, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { marginTop: 10, fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  catIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catName: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
});