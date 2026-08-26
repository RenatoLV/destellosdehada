import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, 
  TextInput, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSales } from '../../hooks/useSales';
import { useProducts } from '../../hooks/useProducts';

export default function NuevaVentaScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { addSale } = useSales();
  const { products, loading: loadingProducts } = useProducts();

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cantidad, setCantidad] = useState(1);
  const [descuento, setDescuento] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Carga e identificación del producto desde la base de datos local SQLite
  useEffect(() => {
    if (products.length > 0) {
      if (productId) {
        const found = products.find(p => String(p.id) === String(productId));
        setSelectedProduct(found || products[0]);
      } else {
        setSelectedProduct(products[0]);
      }
    }
  }, [products, productId]);

  const incrementar = () => {
    if (!selectedProduct) return;
    if (cantidad >= selectedProduct.stock) {
      Alert.alert("Límite de stock", `Solo tienes ${selectedProduct.stock} unidades en inventario.`);
      return;
    }
    setCantidad(prev => prev + 1);
  };

  const decrementar = () => {
    setCantidad(prev => (prev > 1 ? prev - 1 : 1));
  };

  const precioUnitario = selectedProduct ? Number(selectedProduct.price) : 0;
  const descuentoNum = parseInt(descuento.replace(/\./g, '') || '0', 10) || 0;
  const subtotal = precioUnitario * cantidad;
  const totalCalculado = Math.max(0, subtotal - descuentoNum);

  const confirmarVenta = async () => {
    if (!selectedProduct) {
      Alert.alert("Error", "No hay ningún producto seleccionado.");
      return;
    }

    if (selectedProduct.stock < cantidad) {
      Alert.alert("Stock insuficiente", `Solo quedan ${selectedProduct.stock} unidades disponibles de este producto.`);
      return;
    }

    try {
      setGuardando(true);

      // Descuento de stock y guardado local en SQLite con la nueva estructura transaccional
      await addSale({
        items: [
          {
            productId: selectedProduct.id,
            quantity: cantidad,
            unitPrice: Math.round(precioUnitario),
          }
        ],
        discount: descuentoNum,
        notes: notas.trim(),
      });

      router.push('/venta/confirmacion');
    } catch (error: any) {
      console.error("Error al registrar venta en SQLite:", error);
      Alert.alert("Error al cobrar", error.message || "No se pudo registrar la venta en el almacenamiento local.");
    } finally {
      setGuardando(false);
    }
  };

  // ESTADO 1: Cargando productos desde SQLite
  if (loadingProducts) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7B5CF6" />
        <Text style={styles.loadingText}>Cargando información del inventario...</Text>
      </SafeAreaView>
    );
  }

  // ESTADO 2: Sin productos registrados en el sistema
  if (!selectedProduct) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.emptyIconCircle}>
          <Feather name="package" size={42} color="#94A3B8" />
        </View>
        <Text style={styles.noProductTitle}>No hay productos para vender</Text>
        <Text style={styles.noProductSub}>Agrega tu primer producto al inventario antes de realizar un cobro.</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => router.replace('/producto/nuevo')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>Agregar primer producto</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* TARJETA RESUMEN DEL PRODUCTO (Datos reales de SQLite) */}
          <Text style={styles.label}>Producto seleccionado</Text>
          <View style={styles.productCard}>
            <View style={styles.productImageContainer}>
              {selectedProduct.image_uri ? (
                <Image source={{ uri: selectedProduct.image_uri }} style={styles.productImage} />
              ) : (
                <Feather name="image" size={26} color="#9CA3AF" />
              )}
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productTitle} numberOfLines={2}>{selectedProduct.name}</Text>
              <Text style={styles.productPrice}>${precioUnitario.toLocaleString('es-CL')}</Text>
              <View style={styles.stockBadgeRow}>
                <View style={[
                  styles.stockDot, 
                  selectedProduct.stock === 0 ? { backgroundColor: '#EF4444' } : { backgroundColor: '#22C55E' }
                ]} />
                <Text style={styles.productStock}>
                  Stock disponible: {selectedProduct.stock} unidades
                </Text>
              </View>
            </View>
          </View>

          {/* SELECTOR DE CANTIDAD (Controles táctiles de 52px) */}
          <Text style={styles.label}>Cantidad a vender</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={[styles.qtyButton, cantidad <= 1 && styles.qtyButtonDisabled]} 
              onPress={decrementar}
              activeOpacity={0.7}
            >
              <Feather name="minus" size={24} color={cantidad <= 1 ? "#94A3B8" : "#7B5CF6"} />
            </TouchableOpacity>
            
            <View style={styles.qtyDisplayBox}>
              <Text style={styles.qtyDisplay}>{cantidad}</Text>
              <Text style={styles.qtyUnitText}>{cantidad === 1 ? 'unidad' : 'unidades'}</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.qtyButton, cantidad >= selectedProduct.stock && styles.qtyButtonDisabled]} 
              onPress={incrementar}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={24} color={cantidad >= selectedProduct.stock ? "#94A3B8" : "#7B5CF6"} />
            </TouchableOpacity>
          </View>

          {/* DESCUENTO OPCIONAL */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Descuento aplicado </Text>
              <Text style={styles.optionalText}>(opcional)</Text>
            </View>
            <View style={styles.inputWithPrefix}>
              <Text style={styles.prefix}>$</Text>
              <TextInput 
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={descuento}
                onChangeText={setDescuento}
              />
            </View>
          </View>

          {/* TARJETA DESTACADA DE TOTAL A COBRAR */}
          <View style={styles.totalCard}>
            <View>
              <Text style={styles.totalLabel}>Total a cobrar</Text>
              <Text style={styles.subtotalText}>
                Subtotal: ${subtotal.toLocaleString('es-CL')}
                {descuentoNum > 0 ? ` (-$${descuentoNum.toLocaleString('es-CL')})` : ''}
              </Text>
            </View>
            <Text style={styles.totalAmount}>${totalCalculado.toLocaleString('es-CL')}</Text>
          </View>

          {/* NOTAS OPCIONALES */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Notas de la venta </Text>
              <Text style={styles.optionalText}>(opcional)</Text>
            </View>
            <TextInput 
              style={[styles.input, styles.textArea]}
              placeholder="Ej. Pagado en efectivo, cliente frecuente..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={notas}
              onChangeText={setNotas}
            />
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* BOTÓN FLOTANTE INFERIOR */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.confirmBtn, guardando && { opacity: 0.7 }]} 
            onPress={confirmarVenta} 
            activeOpacity={0.85}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirmar venta</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 14,
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noProductTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  noProductSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  scrollContent: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  optionalText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productImageContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 15,
    color: '#7B5CF6',
    fontWeight: '800',
  },
  stockBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  productStock: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
  },
  qtyButton: {
    width: 52,
    height: 52,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
  qtyDisplayBox: {
    alignItems: 'center',
  },
  qtyDisplay: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  qtyUnitText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 20,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5B21B6',
  },
  subtotalText: {
    fontSize: 12,
    color: '#7C3AED',
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7B5CF6',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmBtn: {
    backgroundColor: '#7B5CF6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#7B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});