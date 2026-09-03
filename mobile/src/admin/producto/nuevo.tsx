import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { useCategories } from '../../hooks/useCategories';
import { Picker } from '@react-native-picker/picker'; 
import { useSync } from '../../sync/useSync';
import { getActiveOrganizationContext } from '../../services/organizationContext';

export default function NuevoProductoScreen() {
  const router = useRouter();
  const { addProduct, products } = useAdminProducts();
  const { categories } = useCategories();
  const { syncNow, isOnline } = useSync();

  // Estados del formulario
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [nombre, setNombre] = useState('');
  
  //CAMBIO 1: Inicializa vacío para evitar guardar 'Joyas' como ID de categoría
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stock, setStock] = useState(1);
  const [sku, setSku] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [guardando, setGuardando] = useState(false);

  // La categoría es opcional. Evita asociar una categoría de otra organización.
  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoria(categories[0].id);
    }
  }, [categories]);

  // Control de Stock
  const incrementarStock = () => setStock(prev => prev + 1);
  const decrementarStock = () => setStock(prev => (prev > 0 ? prev - 1 : 0));

  // Manejo de Imágenes
  const abrirCamara = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso requerido", "Se necesita acceso a la cámara para tomar fotos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) setFoto(result.assets[0]);
  };

  const abrirGaleria = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) setFoto(result.assets[0]);
  };

  const guardarProducto = async () => {
    if (!nombre.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el nombre del producto.");
      return;
    }
    if (!precio.trim()) {
      Alert.alert("Campo requerido", "Por favor ingresa el precio de venta.");
      return;
    }

    // Validación de duplicados (Mismo nombre exacto o mismo SKU)
    const nombreLower = nombre.trim().toLowerCase();
    const skuLower = sku.trim().toLowerCase();
    const duplicado = products.find(p => 
      (p.name.toLowerCase() === nombreLower) ||
      (skuLower !== '' && p.sku && p.sku.toLowerCase() === skuLower)
    );

    if (duplicado) {
      const razon = duplicado.name.toLowerCase() === nombreLower ? 'nombre' : 'SKU';
      Alert.alert(
        "Producto Duplicado",
        `Ya existe un producto con el mismo ${razon}: "${duplicado.name}".\nPor favor usa otro nombre o SKU para evitar confusiones.`
      );
      return;
    }

    try {
      setGuardando(true);

      const context = await getActiveOrganizationContext();
      if (context.role !== 'owner' && context.role !== 'admin') {
        Alert.alert('Permiso requerido', 'Solo una persona administradora puede registrar productos.');
        return;
      }

      const precioNumerico = Math.round(parseFloat(precio.replace(/\./g, '').replace(',', '.')) || 0);
      const costoNumerico = Math.round(parseFloat(costo.replace(/\./g, '').replace(',', '.')) || 0);

      await addProduct({
        name: nombre.trim(),
        categoryId: categoria || undefined,
        type: tipo.trim() || 'General',
        price: precioNumerico,
        cost: costoNumerico,
        stock: stock,
        sku: sku.trim(),
        description: descripcion.trim(),
        supplier: proveedor.trim(),
        localImageUri: foto?.uri,
        localImageMimeType: foto?.mimeType || 'image/jpeg',
        localImageFileName: foto?.fileName || `producto-${Date.now()}.jpg`,
      });

      const syncResult = await syncNow();
      const synchronized = isOnline && syncResult.success;

      Alert.alert(
        "¡Producto guardado!", 
        synchronized
          ? `Se registró "${nombre}" y ya está disponible en Supabase.`
          : `Se guardó "${nombre}" en el equipo. Se sincronizará automáticamente al recuperar conexión.`,
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error("Error al guardar en SQLite:", error);
      Alert.alert("Error de guardado", "No se pudo guardar el producto en la base de datos local.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* FOTOS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos del producto</Text>
            <Text style={styles.sectionSubtitle}>Agrega una foto principal desde la cámara o galería</Text>
            
            <View style={styles.photoGrid}>
              {foto ? (
                <View style={styles.photoCard}>
                  <Image source={{ uri: foto.uri }} style={styles.photoImage} />
                  <TouchableOpacity style={styles.deleteBadge} onPress={() => setFoto(null)}>
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : <View style={styles.photoPlaceholder}><Feather name="image" size={24} color="#C4B5FD" /></View>}

              <View style={styles.photoActions}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.photoActionButton} onPress={abrirCamara}>
                    <Feather name="camera" size={18} color="#7B5CF6" />
                    <Text style={styles.photoActionText}>Tomar foto</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.photoActionButton} onPress={abrirGaleria}>
                  <Feather name="image" size={18} color="#7B5CF6" />
                  <Text style={styles.photoActionText}>Elegir archivo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* NOMBRE */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre del producto *</Text>
            <TextInput 
              style={styles.input}
              placeholder="Ej. Collar dorado con dije de corazón"
              placeholderTextColor="#9CA3AF"
              value={nombre}
              onChangeText={setNombre}
            />
          </View>

          {/* CATEGORÍA Y TIPO */}
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
                    <Picker.Item label="Sin categoría" value="" />
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
                placeholder="Ej. Anillo, Cartera..."
                placeholderTextColor="#9CA3AF"
                value={tipo}
                onChangeText={setTipo}
              />
            </View>
          </View>

          {/* PRECIO Y COSTO */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Precio *</Text>
              <View style={styles.inputPrefixWrapper}>
                <Text style={styles.prefix}>$</Text>
                <TextInput 
                  style={styles.inputBare}
                  placeholder="35000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={precio}
                  onChangeText={setPrecio}
                />
              </View>
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <View style={styles.labelOptionalRow}>
                <Text style={styles.label}>Costo </Text>
                <Text style={styles.optionalText}>(opcional)</Text>
              </View>
              <View style={styles.inputPrefixWrapper}>
                <Text style={styles.prefix}>$</Text>
                <TextInput 
                  style={styles.inputBare}
                  placeholder="20000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={costo}
                  onChangeText={setCosto}
                />
              </View>
            </View>
          </View>

          {/* STOCK INICIAL */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Stock inicial</Text>
            <View style={styles.stockBox}>
              <TouchableOpacity style={styles.stockActionBtn} onPress={decrementarStock}>
                <Feather name="minus" size={22} color="#7B5CF6" />
              </TouchableOpacity>
              
              <Text style={styles.stockValue}>{stock}</Text>
              
              <TouchableOpacity style={styles.stockActionBtn} onPress={incrementarStock}>
                <Feather name="plus" size={22} color="#7B5CF6" />
              </TouchableOpacity>
            </View>
          </View>

          {/* DESCRIPCIÓN */}
          <View style={styles.formGroup}>
            <View style={styles.labelOptionalRow}>
              <Text style={styles.label}>Descripción </Text>
              <Text style={styles.optionalText}>(opcional)</Text>
            </View>
            <TextInput 
              style={[styles.input, styles.textArea]}
              placeholder="Hermoso collar dorado con dije en forma de corazón..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={descripcion}
              onChangeText={setDescripcion}
            />
          </View>

          {/* SKU & PROVEEDOR */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <View style={styles.labelOptionalRow}>
                <Text style={styles.label}>Código / SKU </Text>
                <Text style={styles.optionalText}>(opcional)</Text>
              </View>
              <TextInput 
                style={styles.input}
                placeholder="COL-0001"
                placeholderTextColor="#9CA3AF"
                value={sku}
                onChangeText={setSku}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <View style={styles.labelOptionalRow}>
                <Text style={styles.label}>Proveedor </Text>
                <Text style={styles.optionalText}>(opcional)</Text>
              </View>
              <TextInput 
                style={styles.input}
                placeholder="Ej. Taller Joyas"
                placeholderTextColor="#9CA3AF"
                value={proveedor}
                onChangeText={setProveedor}
              />
            </View>
          </View>

          <View style={{ height: 120 }} />

        </ScrollView>

        {/* BOTÓN FLOTANTE */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveButton, guardando && { opacity: 0.7 }]} 
            onPress={guardarProducto} 
            activeOpacity={0.85}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar producto</Text>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 14 },
  photoGrid: { flexDirection: 'row', alignItems: 'center' },
  photoCard: { width: 80, height: 80, borderRadius: 16, marginRight: 12, position: 'relative' },
  photoImage: { width: '100%', height: '100%', borderRadius: 16 },
  deleteBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  photoPlaceholder: { width: 80, height: 80, backgroundColor: '#F8FAFC', borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  photoActions: { flex: 1, gap: 8 },
  photoActionButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 12 },
  photoActionText: { color: '#5B3CC4', fontSize: 13, fontWeight: '700' },
  pickerContainer: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, height: 52, justifyContent: 'center', overflow: 'hidden' },
  picker: { width: '100%', height: '100%', color: '#0F172A' },
  formGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  labelOptionalRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  optionalText: { fontSize: 12, color: '#94A3B8' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#0F172A' },
  textArea: { paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputPrefixWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14 },
  prefix: { fontSize: 15, fontWeight: '600', color: '#64748B', marginRight: 6 },
  inputBare: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#0F172A' },
  stockBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 6 },
  stockActionBtn: { width: 48, height: 48, backgroundColor: '#F5F3FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stockValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  saveButton: { backgroundColor: '#7B5CF6', borderRadius: 16, paddingVertical: 16, alignItems: 'center', boxShadow: '0px 4px 8px rgba(62, 31, 92, 0.25)', elevation: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
