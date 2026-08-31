import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, Image, Switch, ActivityIndicator 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { useCategories } from '../../hooks/useCategories';
import { updateProductLocal, softDeleteProductLocal } from '../../database/products';
import { adjustStockLocal } from '../../database/inventory';

export default function EditarProductoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, loading: loadingProducts, refreshProducts } = useAdminProducts();
  const { categories } = useCategories();

  const productoOriginal = products.find(p => String(p.id) === String(id));

  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('cat_general');
  const [tipo, setTipo] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stock, setStock] = useState(0);
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [sku, setSku] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [activo, setActivo] = useState(true);
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (productoOriginal) {
      setNombre(productoOriginal.name || '');
      setCategoria(productoOriginal.category_id || (categories[0]?.id ?? 'cat_general'));
      setTipo(productoOriginal.type || 'General');
      setPrecio(productoOriginal.price ? String(productoOriginal.price) : '');
      setCosto(productoOriginal.cost ? String(productoOriginal.cost) : '');
      setStock(productoOriginal.stock || 0);
      setSku(productoOriginal.sku || '');
      setDescripcion(productoOriginal.description || '');
      setProveedor(productoOriginal.supplier || '');
      setActivo(productoOriginal.active === 1);
      setFotoUri(productoOriginal.image_uri || null);
    }
  }, [productoOriginal, categories]);

  const incrementarStock = () => setStock(prev => prev + 1);
  const decrementarStock = () => setStock(prev => (prev > 0 ? prev - 1 : 0));

  const seleccionarFoto = () => {
    Alert.alert(
      "Cambiar fotografía",
      "Selecciona el origen de la imagen:",
      [
        { text: "Tomar Foto", onPress: abrirCamara },
        { text: "Elegir de Galería", onPress: abrirGaleria },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const abrirCamara = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso requerido", "Se necesita acceso a la cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const abrirGaleria = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const stockCambio = productoOriginal && stock !== productoOriginal.stock;

  const guardarCambios = async () => {
    if (!nombre.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el nombre del producto.");
      return;
    }
    if (!precio.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el precio de venta.");
      return;
    }

    if (stockCambio && !motivoAjuste.trim()) {
      Alert.alert("Motivo requerido", "Por favor ingresa el motivo del cambio de stock.");
      return;
    }

    try {
      setGuardando(true);
      const precioNum = Math.round(parseFloat(precio.replace(/\./g, '').replace(',', '.')) || 0);
      const costoNum = Math.round(parseFloat(costo.replace(/\./g, '').replace(',', '.')) || 0);

      const categoryIdValido = categoria && categoria.trim() !== '' 
        ? categoria 
        : (categories.length > 0 ? categories[0].id : 'cat_general');

      // 1. Actualizar los datos generales del producto
      await updateProductLocal(String(id), {
        name: nombre.trim(),
        categoryId: categoryIdValido,
        type: tipo.trim() || 'General',
        price: precioNum,
        cost: costoNum,
        sku: sku.trim(),
        description: descripcion.trim(),
        supplier: proveedor.trim(),
        active: activo ? 1 : 0,
        localImageUri: fotoUri || undefined,
      });

      // 2. Si el stock cambió, registrar la corrección de inventario atómica
      if (stockCambio && productoOriginal) {
        const delta = stock - productoOriginal.stock;
        await adjustStockLocal({
          productId: String(id),
          type: 'ADJUSTMENT',
          quantity: delta,
          reason: motivoAjuste.trim(),
        });
      }

      await refreshProducts();

      Alert.alert("¡Cambios guardados!", "La información se actualizó correctamente.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      Alert.alert("Error", "No se pudieron guardar los cambios en la base de datos.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminacion = () => {
    Alert.alert(
      "¿Eliminar este producto?",
      "No se borrará físicamente. Podrás restaurarlo posteriormente.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              await softDeleteProductLocal(String(id));
              await refreshProducts();
              router.replace('/(tabs)/inventario');
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar el producto.");
            }
          } 
        }
      ]
    );
  };

  if (loadingProducts || !productoOriginal) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7B5CF6" />
        <Text style={styles.loadingText}>Cargando datos del producto...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotografía principal</Text>
            <TouchableOpacity style={styles.photoBox} onPress={seleccionarFoto} activeOpacity={0.85}>
              {fotoUri ? (
                <Image source={{ uri: fotoUri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Feather name="camera" size={28} color="#7B5CF6" />
                  <Text style={styles.photoText}>Tocar para cambiar foto</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre del producto *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />
          </View>

          {/* Categoría Dinámica y Tipo Libre */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={categoria}
                  onValueChange={(itemValue) => setCategoria(itemValue)}
                  style={styles.picker}
                >
                  {categories.length === 0 ? (
                    <Picker.Item label="General" value="cat_general" />
                  ) : (
                    categories.map((cat) => (
                      <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
                    ))
                  )}
                </Picker>
              </View>
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Tipo</Text>
              <TextInput 
                style={styles.input} 
                value={tipo} 
                onChangeText={setTipo}
                placeholder="Ej. Anillo, Cartera..."
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Precio de venta *</Text>
              <View style={styles.inputPrefixWrapper}>
                <Text style={styles.prefix}>$</Text>
                <TextInput style={styles.inputBare} keyboardType="numeric" value={precio} onChangeText={setPrecio} />
              </View>
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Costo (opcional)</Text>
              <View style={styles.inputPrefixWrapper}>
                <Text style={styles.prefix}>$</Text>
                <TextInput style={styles.inputBare} keyboardType="numeric" value={costo} onChangeText={setCosto} />
              </View>
            </View>
          </View>

          {/* Control de Stock con Trazabilidad */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Stock actual</Text>
            <View style={styles.stockBox}>
              <TouchableOpacity style={styles.stockActionBtn} onPress={decrementarStock}>
                <Feather name="minus" size={22} color="#7B5CF6" />
              </TouchableOpacity>
              
              <Text style={styles.stockValue}>{stock}</Text>
              
              <TouchableOpacity style={styles.stockActionBtn} onPress={incrementarStock}>
                <Feather name="plus" size={22} color="#7B5CF6" />
              </TouchableOpacity>
            </View>

            {stockCambio && (
              <View style={styles.reasonCard}>
                <Text style={styles.reasonLabel}>Motivo del cambio de stock *</Text>
                <TextInput 
                  style={styles.inputReason}
                  placeholder="Ej. Conteo manual, daño de mercancía..."
                  placeholderTextColor="#9CA3AF"
                  value={motivoAjuste}
                  onChangeText={setMotivoAjuste}
                />
              </View>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Código / SKU</Text>
              <TextInput style={styles.input} value={sku} onChangeText={setSku} />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Proveedor</Text>
              <TextInput style={styles.input} value={proveedor} onChangeText={setProveedor} />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Descripción</Text>
            <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={3} value={descripcion} onChangeText={setDescripcion} />
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Producto activo</Text>
              <Text style={styles.switchSublabel}>Habilitado para venta e inventario</Text>
            </View>
            <Switch
              trackColor={{ false: '#E2E8F0', true: '#DDD6FE' }}
              thumbColor={activo ? '#7B5CF6' : '#94A3B8'}
              onValueChange={setActivo}
              value={activo}
            />
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={confirmarEliminacion} activeOpacity={0.8}>
            <Feather name="trash-2" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.deleteBtnText}>Eliminar producto</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveButton, guardando && { opacity: 0.7 }]} 
            onPress={guardarCambios} 
            activeOpacity={0.85}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20 },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  scrollContent: { padding: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  photoBox: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoText: { marginTop: 8, fontSize: 13, color: '#7B5CF6', fontWeight: '600' },
  formGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#0F172A' },
  textArea: { paddingTop: 12, textAlignVertical: 'top' },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center', // <-- Corregido (antes decía justify)
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: '100%',
    color: '#0F172A',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputPrefixWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14 },
  prefix: { fontSize: 15, fontWeight: '600', color: '#64748B', marginRight: 6 },
  inputBare: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#0F172A' },
  stockBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 6 },
  stockActionBtn: { width: 48, height: 48, backgroundColor: '#F5F3FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stockValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  reasonCard: { marginTop: 12, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  reasonLabel: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  inputReason: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  switchSublabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', marginTop: 10 },
  deleteBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  saveButton: { backgroundColor: '#7B5CF6', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
