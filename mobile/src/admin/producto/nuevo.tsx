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

function formatThousands(value: string | number): string {
  const digits = String(value).replace(/\D/g, '');
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

export default function NuevoProductoScreen() {
  const router = useRouter();
  const { addProduct, products } = useAdminProducts();
  const { categories, addCategory, refreshCategories } = useCategories();
  const { syncNow, isOnline } = useSync();

  // Estados del formulario
  const [fotos, setFotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fotoPrincipalUri, setFotoPrincipalUri] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  
  //CAMBIO 1: Inicializa vacío para evitar guardar 'Joyas' como ID de categoría
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stock, setStock] = useState(1);
  const [sku, setSku] = useState('');
  const [skuManual, setSkuManual] = useState(false);
  const [nuevaCategoriaVisible, setNuevaCategoriaVisible] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [guardando, setGuardando] = useState(false);

  // La categoría es opcional. Evita asociar una categoría de otra organización.
  useEffect(() => {
    if (!categoria && categories.length > 0) {
      setCategoria(categories[0].id);
    }
  }, [categoria, categories]);

  const generarSku = (categoryId: string, categoryName?: string): string => {
    const nombreCategoria = categoryName
      || categories.find(category => category.id === categoryId)?.name
      || 'Producto';
    const prefijo = nombreCategoria
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, 'X');
    let correlativo = 1;
    let candidato = `${prefijo}-${String(correlativo).padStart(4, '0')}`;
    const existentes = new Set(products.map(product => product.sku?.toUpperCase()).filter(Boolean));
    while (existentes.has(candidato)) {
      correlativo += 1;
      candidato = `${prefijo}-${String(correlativo).padStart(4, '0')}`;
    }
    return candidato;
  };

  useEffect(() => {
    if (!skuManual) setSku(generarSku(categoria));
  }, [categoria, categories, products, skuManual]);

  const seleccionarCategoria = (categoryId: string) => {
    setCategoria(categoryId);
    if (!skuManual) setSku(generarSku(categoryId));
  };

  const crearCategoria = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) {
      Alert.alert('Nombre requerido', 'Escribe el nombre de la nueva categoría.');
      return;
    }
    const existente = categories.find(category => category.name.toLocaleLowerCase('es-CL') === nombre.toLocaleLowerCase('es-CL'));
    if (existente) {
      seleccionarCategoria(existente.id);
      setNuevaCategoria('');
      setNuevaCategoriaVisible(false);
      return;
    }
    try {
      setGuardandoCategoria(true);
      const context = await getActiveOrganizationContext();
      if (context.role !== 'owner' && context.role !== 'admin') {
        Alert.alert('Permiso requerido', 'Solo una persona administradora puede crear categorías.');
        return;
      }
      const categoryId = await addCategory(nombre);
      setCategoria(categoryId);
      setSkuManual(false);
      setSku(generarSku(categoryId, nombre));
      setNuevaCategoria('');
      setNuevaCategoriaVisible(false);
      await refreshCategories();
    } catch (error) {
      console.error('Error al crear categoría:', error);
      Alert.alert('Error de categoría', 'No se pudo guardar la categoría en este equipo.');
    } finally {
      setGuardandoCategoria(false);
    }
  };

  // Control de Stock
  const incrementarStock = () => setStock(prev => prev + 1);
  const decrementarStock = () => setStock(prev => (prev > 0 ? prev - 1 : 0));

  // Manejo de Imágenes
  const agregarFotos = (assets: ImagePicker.ImagePickerAsset[]) => {
    setFotos(current => {
      const disponibles = Math.max(0, 3 - current.length);
      if (disponibles === 0) {
        Alert.alert('Máximo alcanzado', 'Puedes registrar hasta 3 fotografías por producto.');
        return current;
      }
      const nuevas = assets
        .filter(asset => !current.some(existing => existing.uri === asset.uri))
        .slice(0, disponibles);
      if (!fotoPrincipalUri && nuevas[0]) setFotoPrincipalUri(nuevas[0].uri);
      return [...current, ...nuevas];
    });
  };

  const quitarFoto = (uri: string) => {
    setFotos(current => {
      const remaining = current.filter(asset => asset.uri !== uri);
      if (fotoPrincipalUri === uri) setFotoPrincipalUri(remaining[0]?.uri ?? null);
      return remaining;
    });
  };

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

    if (!result.canceled && result.assets[0].uri) agregarFotos([result.assets[0]]);
  };

  const abrirGaleria = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 3 - fotos.length),
      quality: 0.8,
    });

    if (!result.canceled) agregarFotos(result.assets);
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

      const precioNumerico = Number(precio.replace(/\./g, '')) || 0;
      const costoNumerico = Number(costo.replace(/\./g, '')) || 0;

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
        images: fotos.map((foto, index) => ({
          uri: foto.uri,
          mimeType: foto.mimeType || 'image/jpeg',
          fileName: foto.fileName || `producto-${Date.now()}-${index + 1}.jpg`,
          isPrimary: foto.uri === fotoPrincipalUri,
        })),
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
            onPress: () => router.replace('/inventario')
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
            <Text style={styles.sectionSubtitle}>Agrega hasta 3 fotos. Toca una para elegirla como principal.</Text>
            
            <View style={styles.photoList}>
              {fotos.map((foto, index) => {
                const isPrimary = foto.uri === fotoPrincipalUri;
                return (
                  <TouchableOpacity
                    key={foto.uri}
                    style={[styles.photoCard, isPrimary && styles.photoCardPrimary]}
                    onPress={() => setFotoPrincipalUri(foto.uri)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: foto.uri }} style={styles.photoImage} />
                    <View style={[styles.primaryBadge, isPrimary && styles.primaryBadgeActive]}>
                      <Feather name="star" size={11} color={isPrimary ? '#FFFFFF' : '#6D4DE0'} />
                      <Text style={[styles.primaryBadgeText, isPrimary && styles.primaryBadgeTextActive]}>
                        {isPrimary ? 'Principal' : `${index + 1}`}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.deleteBadge} onPress={() => quitarFoto(foto.uri)}>
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              {fotos.length < 3 && (
                <TouchableOpacity style={styles.photoPlaceholder} onPress={abrirGaleria}>
                  <Feather name="plus" size={24} color="#7B5CF6" />
                  <Text style={styles.photoPlaceholderText}>{fotos.length}/3</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.photoActions}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.photoActionButton} onPress={abrirCamara}>
                    <Feather name="camera" size={18} color="#7B5CF6" />
                    <Text style={styles.photoActionText}>Tomar foto</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.photoActionButton} onPress={abrirGaleria}>
                  <Feather name="image" size={18} color="#7B5CF6" />
                  <Text style={styles.photoActionText}>Elegir archivos</Text>
                </TouchableOpacity>
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
                  onValueChange={(itemValue) => seleccionarCategoria(String(itemValue))}
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
              <TouchableOpacity
                style={styles.addCategoryButton}
                onPress={() => setNuevaCategoriaVisible(visible => !visible)}
              >
                <Feather name="plus-circle" size={14} color="#7B5CF6" />
                <Text style={styles.addCategoryText}>Nueva categoría</Text>
              </TouchableOpacity>
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

          {nuevaCategoriaVisible && (
            <View style={styles.newCategoryCard}>
              <Text style={styles.newCategoryLabel}>Nombre de la categoría</Text>
              <View style={styles.newCategoryRow}>
                <TextInput
                  style={[styles.input, styles.newCategoryInput]}
                  placeholder="Ej. Anillos"
                  placeholderTextColor="#9CA3AF"
                  value={nuevaCategoria}
                  onChangeText={setNuevaCategoria}
                  autoCapitalize="words"
                />
                <TouchableOpacity
                  style={[styles.createCategoryButton, guardandoCategoria && styles.disabledButton]}
                  onPress={crearCategoria}
                  disabled={guardandoCategoria}
                >
                  {guardandoCategoria ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.createCategoryText}>Crear</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PRECIO Y COSTO */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Precio *</Text>
              <View style={styles.inputPrefixWrapper}>
                <Text style={styles.prefix}>$</Text>
                <TextInput 
                  style={styles.inputBare}
                  placeholder="20.000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={precio}
                  onChangeText={(value) => setPrecio(formatThousands(value))}
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
                  placeholder="20.000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={costo}
                  onChangeText={(value) => setCosto(formatThousands(value))}
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
              
              <Text style={styles.stockValue}>{formatThousands(stock)}</Text>
              
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
                <Text style={styles.label}>Código / SKU</Text>
              </View>
              <TextInput 
                style={styles.input}
                placeholder="Se genera según categoría"
                placeholderTextColor="#9CA3AF"
                value={sku}
                onChangeText={(value) => {
                  setSku(value.toUpperCase());
                  setSkuManual(true);
                }}
              />
              <View style={styles.skuHintRow}>
                <Text style={styles.skuHint}>{skuManual ? 'SKU personalizado' : 'Generado automáticamente por categoría'}</Text>
                <TouchableOpacity onPress={() => {
                  setSkuManual(false);
                  setSku(generarSku(categoria));
                }}>
                  <Text style={styles.regenerateSku}>Regenerar</Text>
                </TouchableOpacity>
              </View>
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
  photoList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  photoCard: { width: 88, height: 88, borderRadius: 16, position: 'relative', borderWidth: 2, borderColor: 'transparent' },
  photoCardPrimary: { borderColor: '#7B5CF6' },
  photoImage: { width: '100%', height: '100%', borderRadius: 16 },
  deleteBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  primaryBadge: { position: 'absolute', left: 5, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },
  primaryBadgeActive: { backgroundColor: '#6D4DE0' },
  primaryBadgeText: { color: '#6D4DE0', fontSize: 9, fontWeight: '800' },
  primaryBadgeTextActive: { color: '#FFFFFF' },
  photoPlaceholder: { width: 88, height: 88, backgroundColor: '#F8F5FF', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C4B5FD', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { marginTop: 3, color: '#786F7D', fontSize: 10, fontWeight: '700' },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoActionButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 12 },
  photoActionText: { color: '#5B3CC4', fontSize: 13, fontWeight: '700' },
  pickerContainer: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, height: 52, justifyContent: 'center', overflow: 'hidden' },
  picker: { width: '100%', height: '100%', color: '#0F172A' },
  addCategoryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8 },
  addCategoryText: { color: '#6D4DE0', fontSize: 12, fontWeight: '700' },
  newCategoryCard: { backgroundColor: '#F8F5FF', borderRadius: 14, borderWidth: 1, borderColor: '#E5DDFE', padding: 12, marginTop: -8, marginBottom: 18 },
  newCategoryLabel: { color: '#4C356E', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  newCategoryRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  newCategoryInput: { flex: 1, paddingVertical: 11 },
  createCategoryButton: { minWidth: 70, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7B5CF6', borderRadius: 12, paddingHorizontal: 12 },
  createCategoryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
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
  skuHintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  skuHint: { color: '#786F7D', fontSize: 11, flex: 1, marginRight: 8 },
  regenerateSku: { color: '#6D4DE0', fontSize: 11, fontWeight: '800' },
  stockBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 6 },
  stockActionBtn: { width: 48, height: 48, backgroundColor: '#F5F3FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stockValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  saveButton: { backgroundColor: '#7B5CF6', borderRadius: 16, paddingVertical: 16, alignItems: 'center', boxShadow: '0px 4px 8px rgba(62, 31, 92, 0.25)', elevation: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
