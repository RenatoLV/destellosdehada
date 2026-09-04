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
import { getProductImagesLocal, updateProductLocal, softDeleteProductLocal } from '../../database/products';
import { adjustStockLocal } from '../../database/inventory';
import { getActiveOrganizationContext } from '../../services/organizationContext';
import { useSync } from '../../sync/useSync';
import { ProductImage } from '../../types/database';

export default function EditarProductoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, loading: loadingProducts, refreshProducts } = useAdminProducts();
  const { categories } = useCategories();
  const { syncNow, isOnline } = useSync();

  const productoOriginal = products.find(p => String(p.id) === String(id));

  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stock, setStock] = useState(0);
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [sku, setSku] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [activo, setActivo] = useState(true);
  const [fotosExistentes, setFotosExistentes] = useState<ProductImage[]>([]);
  const [fotosNuevas, setFotosNuevas] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [fotoPrincipalKey, setFotoPrincipalKey] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (productoOriginal) {
      setNombre(productoOriginal.name || '');
      setCategoria(productoOriginal.category_id || '');
      setTipo(productoOriginal.type || 'General');
      setPrecio(productoOriginal.price ? String(productoOriginal.price) : '');
      setCosto(productoOriginal.cost ? String(productoOriginal.cost) : '');
      setStock(productoOriginal.stock || 0);
      setSku(productoOriginal.sku || '');
      setDescripcion(productoOriginal.description || '');
      setProveedor(productoOriginal.supplier || '');
      setActivo(productoOriginal.active === 1);
    }
  }, [productoOriginal, categories]);

  useEffect(() => {
    let active = true;
    const loadImages = async () => {
      if (!id) return;
      try {
        const images = await getProductImagesLocal(String(id));
        if (!active) return;
        setFotosExistentes(images.slice(0, 3));
        const primary = images.find(image => image.is_primary === 1) ?? images[0];
        setFotoPrincipalKey(primary ? `existing:${primary.id}` : null);
      } catch (error) {
        console.error('Error al cargar las fotografías del producto:', error);
      }
    };
    void loadImages();
    return () => { active = false; };
  }, [id]);

  const incrementarStock = () => setStock(prev => prev + 1);
  const decrementarStock = () => setStock(prev => (prev > 0 ? prev - 1 : 0));

  const agregarFotos = (assets: ImagePicker.ImagePickerAsset[]) => {
    const totalActual = fotosExistentes.length + fotosNuevas.length;
    const disponibles = Math.max(0, 3 - totalActual);
    if (disponibles === 0) {
      Alert.alert('Máximo alcanzado', 'Puedes registrar hasta 3 fotografías por producto.');
      return;
    }
    const nuevas = assets
      .filter(asset => !fotosNuevas.some(existing => existing.uri === asset.uri))
      .slice(0, disponibles);
    setFotosNuevas(current => [...current, ...nuevas]);
    if (!fotoPrincipalKey && nuevas[0]) setFotoPrincipalKey(`new:${nuevas[0].uri}`);
  };

  const quitarFotoNueva = (uri: string) => {
    const remaining = fotosNuevas.filter(asset => asset.uri !== uri);
    setFotosNuevas(remaining);
    if (fotoPrincipalKey === `new:${uri}`) {
      const existingPrimary = fotosExistentes.find(image => image.is_primary === 1) ?? fotosExistentes[0];
      setFotoPrincipalKey(existingPrimary
        ? `existing:${existingPrimary.id}`
        : remaining[0] ? `new:${remaining[0].uri}` : null);
    }
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
      agregarFotos([result.assets[0]]);
    }
  };

  const abrirGaleria = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 3 - fotosExistentes.length - fotosNuevas.length),
      quality: 0.8,
    });
    if (!result.canceled) agregarFotos(result.assets);
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

    const nombreNormalizado = nombre.trim().toLocaleLowerCase('es-CL');
    const skuNormalizado = sku.trim().toLocaleLowerCase('es-CL');
    const duplicado = products.find(product => product.id !== productoOriginal?.id && (
      product.name.trim().toLocaleLowerCase('es-CL') === nombreNormalizado
      || (skuNormalizado.length > 0 && product.sku?.trim().toLocaleLowerCase('es-CL') === skuNormalizado)
    ));
    if (duplicado) {
      Alert.alert('Producto duplicado', `Ya existe "${duplicado.name}" con el mismo nombre o SKU.`);
      return;
    }

    try {
      setGuardando(true);
      const context = await getActiveOrganizationContext();
      if (context.role !== 'owner' && context.role !== 'admin') {
        Alert.alert('Permiso requerido', 'Solo una persona administradora puede modificar productos.');
        return;
      }
      const precioNum = Math.round(parseFloat(precio.replace(/\./g, '').replace(',', '.')) || 0);
      const costoNum = Math.round(parseFloat(costo.replace(/\./g, '').replace(',', '.')) || 0);

      const categoryIdValido = categoria.trim() || undefined;

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
        images: fotosNuevas.map((foto, index) => ({
          uri: foto.uri,
          mimeType: foto.mimeType || 'image/jpeg',
          fileName: foto.fileName || `producto-${String(id)}-${Date.now()}-${index + 1}.jpg`,
          isPrimary: fotoPrincipalKey === `new:${foto.uri}`,
        })),
        primaryImageId: fotoPrincipalKey?.startsWith('existing:')
          ? fotoPrincipalKey.slice('existing:'.length)
          : undefined,
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
      const syncResult = await syncNow(true);
      const synchronized = isOnline && syncResult.success;

      Alert.alert("¡Cambios guardados!", synchronized
        ? 'La información y el stock ya se actualizaron en Supabase.'
        : 'Los cambios quedaron guardados en este equipo y se sincronizarán al recuperar conexión.', [
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
            <Text style={styles.sectionTitle}>Fotografías del producto</Text>
            <Text style={styles.sectionSubtitle}>Hasta 3 imágenes. Toca una para usarla como principal.</Text>
            <View style={styles.photoList}>
              {fotosExistentes.map((foto, index) => {
                const key = `existing:${foto.id}`;
                const isPrimary = fotoPrincipalKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.photoCard, isPrimary && styles.photoCardPrimary]}
                    onPress={() => setFotoPrincipalKey(key)}
                    activeOpacity={0.8}
                  >
                    {foto.local_uri ? <Image source={{ uri: foto.local_uri }} style={styles.photoImage} resizeMode="cover" /> : <Feather name="image" size={26} color="#C4B5FD" />}
                    <View style={[styles.primaryBadge, isPrimary && styles.primaryBadgeActive]}>
                      <Feather name="star" size={11} color={isPrimary ? '#FFFFFF' : '#6D4DE0'} />
                      <Text style={[styles.primaryBadgeText, isPrimary && styles.primaryBadgeTextActive]}>
                        {isPrimary ? 'Principal' : `${index + 1}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {fotosNuevas.map((foto, index) => {
                const key = `new:${foto.uri}`;
                const isPrimary = fotoPrincipalKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.photoCard, isPrimary && styles.photoCardPrimary]}
                    onPress={() => setFotoPrincipalKey(key)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: foto.uri }} style={styles.photoImage} resizeMode="cover" />
                    <View style={[styles.primaryBadge, isPrimary && styles.primaryBadgeActive]}>
                      <Feather name="star" size={11} color={isPrimary ? '#FFFFFF' : '#6D4DE0'} />
                      <Text style={[styles.primaryBadgeText, isPrimary && styles.primaryBadgeTextActive]}>
                        {isPrimary ? 'Principal' : `${fotosExistentes.length + index + 1}`}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.deleteBadge} onPress={() => quitarFotoNueva(foto.uri)}>
                      <Feather name="x" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              {fotosExistentes.length + fotosNuevas.length < 3 && (
                <TouchableOpacity style={styles.photoPlaceholder} onPress={abrirGaleria}>
                  <Feather name="plus" size={24} color="#7B5CF6" />
                  <Text style={styles.photoCount}>{fotosExistentes.length + fotosNuevas.length}/3</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.photoActions}>
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.photoActionButton} onPress={abrirCamara}>
                  <Feather name="camera" size={18} color="#6D4DE0" />
                  <Text style={styles.photoActionText}>Tomar foto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.photoActionButton} onPress={abrirGaleria}>
                <Feather name="folder" size={18} color="#6D4DE0" />
                <Text style={styles.photoActionText}>Elegir archivos</Text>
              </TouchableOpacity>
            </View>
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
                  onValueChange={(itemValue) => setCategoria(String(itemValue))}
                  style={styles.picker}
                >
                  <Picker.Item label="Sin categoría" value="" />
                  {categories.map((cat) => (
                    <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
                  ))}
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

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push({ pathname: '/producto/historial', params: { id: String(id) } })}
            activeOpacity={0.8}
          >
            <Feather name="clock" size={18} color="#6D4DE0" />
            <Text style={styles.historyBtnText}>Ver historial de movimientos</Text>
          </TouchableOpacity>

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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  photoList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  photoCard: { width: 88, height: 88, borderRadius: 16, overflow: 'visible', backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  photoCardPrimary: { borderColor: '#7B5CF6' },
  photoImage: { width: '100%', height: '100%', borderRadius: 14 },
  photoPlaceholder: { width: 88, height: 88, borderRadius: 16, backgroundColor: '#F8F5FF', borderWidth: 1, borderStyle: 'dashed', borderColor: '#C4B5FD', justifyContent: 'center', alignItems: 'center' },
  photoCount: { marginTop: 3, color: '#786F7D', fontSize: 10, fontWeight: '700' },
  primaryBadge: { position: 'absolute', left: 5, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },
  primaryBadgeActive: { backgroundColor: '#6D4DE0' },
  primaryBadgeText: { color: '#6D4DE0', fontSize: 9, fontWeight: '800' },
  primaryBadgeTextActive: { color: '#FFFFFF' },
  deleteBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoActionButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 12 },
  photoActionText: { color: '#5B3CC4', fontSize: 13, fontWeight: '700' },
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
  historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: '#F5F3FF', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6FE', marginBottom: 12 },
  historyBtnText: { color: '#6D4DE0', fontWeight: '700', fontSize: 14 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', marginTop: 10 },
  deleteBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  saveButton: { backgroundColor: '#7B5CF6', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
