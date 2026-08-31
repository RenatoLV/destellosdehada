import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { ClientSelectModal } from '../../components/ClientSelectModal';
import { CartItem, Client, Product } from '../../types/database';

type CartPanelProps = {
  cart: CartItem[];
  discount: string;
  notes: string;
  selectedClient: Client | null;
  totalItems: number;
  subtotal: number;
  total: number;
  saving: boolean;
  onChangeQuantity: (productId: string, delta: number) => void;
  onOpenClient: () => void;
  onDiscountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
};

function CartPanel({
  cart,
  discount,
  notes,
  selectedClient,
  totalItems,
  subtotal,
  total,
  saving,
  onChangeQuantity,
  onOpenClient,
  onDiscountChange,
  onNotesChange,
  onConfirm,
}: CartPanelProps) {
  const discountNumber = Number(discount.replace(/\D/g, '') || 0);

  return (
    <View style={styles.cartPanel}>
      <View style={styles.panelTitleRow}>
        <View>
          <Text style={styles.panelTitle}>Tu carrito</Text>
          <Text style={styles.panelSubtitle}>{totalItems} {totalItems === 1 ? 'pieza' : 'piezas'}</Text>
        </View>
        <View style={styles.cartCountBadge}><Text style={styles.cartCountText}>{cart.length}</Text></View>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <Feather name="shopping-bag" size={28} color="#B7A4C8" />
          <Text style={styles.emptyCartTitle}>Aún no hay piezas</Text>
          <Text style={styles.emptyCartText}>Toca “Agregar” en el catálogo para comenzar la venta.</Text>
        </View>
      ) : (
        <View style={styles.cartLines}>
          {cart.map(item => (
            <View key={item.product.id} style={styles.cartLine}>
              <View style={styles.cartLineImage}>
                {item.product.image_uri ? <Image source={{ uri: item.product.image_uri }} style={styles.imageFill} /> : <Feather name="star" size={16} color="#B7A4C8" />}
              </View>
              <View style={styles.cartLineInfo}>
                <Text style={styles.cartLineName} numberOfLines={1}>{item.product.name}</Text>
                <Text style={styles.cartLinePrice}>${(item.unitPrice * item.quantity).toLocaleString('es-CL')}</Text>
                <Text style={styles.cartLineStock}>Disponible: {item.product.stock}</Text>
              </View>
              <View style={styles.lineQuantity}>
                <TouchableOpacity onPress={() => onChangeQuantity(item.product.id, -1)} style={styles.lineQtyButton} accessibilityLabel={`Reducir ${item.product.name}`}>
                  <Feather name="minus" size={14} color="#5A3475" />
                </TouchableOpacity>
                <Text style={styles.lineQtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => onChangeQuantity(item.product.id, 1)} style={styles.lineQtyButton} accessibilityLabel={`Aumentar ${item.product.name}`}>
                  <Feather name="plus" size={14} color="#5A3475" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.fieldLabel}>Cliente <Text style={styles.optional}>(opcional)</Text></Text>
      <TouchableOpacity style={styles.clientSelectorCard} onPress={onOpenClient} activeOpacity={0.75}>
        <View style={styles.clientSelectorIcon}><Feather name={selectedClient ? 'user-check' : 'user'} size={18} color={selectedClient ? '#23805B' : '#7651A7'} /></View>
        <View style={styles.clientSelectorInfo}>
          <Text style={styles.clientSelectorTitle}>{selectedClient ? selectedClient.name : 'Venta rápida'}</Text>
          <Text style={styles.clientSelectorSub}>{selectedClient ? (selectedClient.phone || selectedClient.rut || 'Cliente registrado') : 'Sin cliente asociado'}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#B8ADB9" />
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Descuento <Text style={styles.optional}>(opcional)</Text></Text>
      <View style={styles.inputWithPrefix}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#A69AA9"
          keyboardType="numeric"
          value={discount}
          onChangeText={onDiscountChange}
        />
      </View>

      <Text style={styles.fieldLabel}>Nota <Text style={styles.optional}>(opcional)</Text></Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Ej. Transferencia recibida"
        placeholderTextColor="#A69AA9"
        value={notes}
        onChangeText={onNotesChange}
        multiline
        numberOfLines={2}
      />

      <View style={styles.totalCard}>
        <View>
          <Text style={styles.totalLabel}>Total a cobrar</Text>
          <Text style={styles.subtotalText}>Subtotal ${subtotal.toLocaleString('es-CL')}{discountNumber > 0 ? ` · -$${discountNumber.toLocaleString('es-CL')}` : ''}</Text>
        </View>
        <Text style={styles.totalAmount}>${total.toLocaleString('es-CL')}</Text>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, (saving || cart.length === 0) && styles.disabledButton]}
        onPress={onConfirm}
        disabled={saving || cart.length === 0}
        activeOpacity={0.86}
      >
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Feather name="check" size={18} color="#FFFFFF" /><Text style={styles.confirmBtnText}>Confirmar venta</Text></>}
      </TouchableOpacity>
    </View>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const unavailable = product.stock <= 0;
  return (
    <View style={styles.catalogCard}>
      <View style={styles.catalogImage}>
        {product.image_uri ? <Image source={{ uri: product.image_uri }} style={styles.imageFill} /> : <Feather name="star" size={24} color="#B7A4C8" />}
      </View>
      <View style={styles.catalogInfo}>
        <Text style={styles.catalogName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.catalogCategory}>{product.category_id || 'Joyería'}</Text>
        <Text style={styles.catalogPrice}>${Number(product.price).toLocaleString('es-CL')}</Text>
        <Text style={[styles.catalogStock, unavailable && styles.catalogStockOut]}>{unavailable ? 'Agotado' : `${product.stock} disponibles`}</Text>
      </View>
      <TouchableOpacity style={[styles.addProductButton, unavailable && styles.addProductDisabled]} onPress={onAdd} disabled={unavailable} activeOpacity={0.8} accessibilityLabel={`Agregar ${product.name}`}>
        <Feather name="plus" size={20} color={unavailable ? '#A8A0A9' : '#FFFFFF'} />
      </TouchableOpacity>
    </View>
  );
}

export default function NuevaVentaScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { addSale } = useSales();
  const { products, loading: loadingProducts } = useProducts();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [clientVisible, setClientVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const isDesktop = width >= 820;

  useEffect(() => {
    if (!productId || products.length === 0) return;
    const product = products.find(item => String(item.id) === String(productId));
    if (product) setCart(current => current.some(item => item.product.id === product.id) ? current : [{ product, quantity: 1, unitPrice: Number(product.price) }, ...current]);
  }, [productId, products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(product => `${product.name} ${product.sku || ''} ${product.category_id || ''}`.toLowerCase().includes(query));
  }, [products, search]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountNumber = Number(discount.replace(/\D/g, '') || 0);
    return { subtotal, discountNumber, total: Math.max(0, subtotal - discountNumber), totalItems: cart.reduce((sum, item) => sum + item.quantity, 0) };
  }, [cart, discount]);

  const addToCart = (product: Product) => {
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert('Límite de stock', `Solo quedan ${product.stock} unidades de ${product.name}.`);
          return current;
        }
        return current.map(item => item.product.id === product.id ? { ...item, product, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1, unitPrice: Number(product.price) }];
    });
  };

  const changeQuantity = (productIdToChange: string, delta: number) => {
    setCart(current => current.flatMap(item => {
      if (item.product.id !== productIdToChange) return [item];
      const nextQuantity = item.quantity + delta;
      if (nextQuantity <= 0) return [];
      if (nextQuantity > item.product.stock) {
        Alert.alert('Límite de stock', `Solo quedan ${item.product.stock} unidades de ${item.product.name}.`);
        return [item];
      }
      return [{ ...item, quantity: nextQuantity }];
    }));
  };

  const confirmSale = async () => {
    if (cart.length === 0) return;
    if (totals.discountNumber > totals.subtotal) {
      Alert.alert('Descuento no válido', 'El descuento no puede superar el subtotal.');
      return;
    }
    try {
      setSaving(true);
      await addSale({
        items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, unitPrice: Math.round(item.unitPrice) })),
        discount: totals.discountNumber,
        notes: notes.trim(),
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || null,
      });
      setCartVisible(false);
      router.push('/venta/confirmacion');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar la venta localmente.';
      Alert.alert('Error al cobrar', message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingProducts) {
    return <SafeAreaView style={styles.centerContainer}><ActivityIndicator size="large" color="#7651A7" /><Text style={styles.loadingText}>Cargando catálogo local...</Text></SafeAreaView>;
  }

  if (products.length === 0) {
    return <SafeAreaView style={styles.centerContainer}>
      <View style={styles.emptyIconCircle}><Feather name="package" size={38} color="#B7A4C8" /></View>
      <Text style={styles.noProductTitle}>Catálogo sin productos</Text>
      <Text style={styles.noProductSub}>El catálogo se administra desde la aplicación Admin. Sincroniza para cargar productos disponibles.</Text>
      <TouchableOpacity style={styles.addBtn} onPress={() => router.replace('/(tabs)/mas')} activeOpacity={0.85}><Feather name="refresh-cw" size={18} color="#FFFFFF" style={{ marginRight: 8 }} /><Text style={styles.addBtnText}>Revisar sincronización</Text></TouchableOpacity>
    </SafeAreaView>;
  }

  const listHeader = <View>
    <View style={styles.titleRow}><View><Text style={styles.screenTitle}>Nueva venta</Text><Text style={styles.screenSubtitle}>{products.length} piezas disponibles</Text></View><TouchableOpacity onPress={() => router.back()} style={styles.closeButton} accessibilityLabel="Cerrar nueva venta"><Feather name="x" size={20} color="#5A3475" /></TouchableOpacity></View>
    <View style={styles.searchBox}><Feather name="search" size={18} color="#7651A7" /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar joya, SKU o categoría" placeholderTextColor="#A69AA9" clearButtonMode="while-editing" /></View>
    <View style={styles.catalogHeader}><Text style={styles.catalogTitle}>Catálogo</Text><Text style={styles.catalogHint}>Selecciona las piezas del cobro</Text></View>
  </View>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, isDesktop && styles.desktopContent]}>
          <View style={[styles.catalogColumn, isDesktop && styles.catalogColumnDesktop]}>
            <FlatList
              data={filteredProducts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <ProductCard product={item} onAdd={() => addToCart(item)} />}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={<View style={styles.noResults}><Feather name="search" size={24} color="#B7A4C8" /><Text style={styles.noResultsText}>No encontramos piezas con esa búsqueda.</Text></View>}
              contentContainerStyle={styles.catalogList}
              showsVerticalScrollIndicator={false}
            />
          </View>

          {isDesktop ? (
            <View style={styles.desktopCartColumn}><CartPanel cart={cart} discount={discount} notes={notes} selectedClient={selectedClient} totalItems={totals.totalItems} subtotal={totals.subtotal} total={totals.total} saving={saving} onChangeQuantity={changeQuantity} onOpenClient={() => setClientVisible(true)} onDiscountChange={setDiscount} onNotesChange={setNotes} onConfirm={confirmSale} /></View>
          ) : (
            <View style={styles.mobileCartBar}>
              <View><Text style={styles.mobileCartLabel}>{totals.totalItems} {totals.totalItems === 1 ? 'pieza' : 'piezas'} en carrito</Text><Text style={styles.mobileCartTotal}>${totals.total.toLocaleString('es-CL')}</Text></View>
              <TouchableOpacity style={styles.mobileCartButton} onPress={() => setCartVisible(true)} activeOpacity={0.85}><Text style={styles.mobileCartButtonText}>Ver carrito</Text><Feather name="arrow-up" size={16} color="#FFFFFF" /></TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={cartVisible} animationType="slide" transparent onRequestClose={() => setCartVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.bottomSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Resumen del cobro</Text><TouchableOpacity onPress={() => setCartVisible(false)} accessibilityLabel="Cerrar carrito"><Feather name="x" size={20} color="#5A3475" /></TouchableOpacity></View><CartPanel cart={cart} discount={discount} notes={notes} selectedClient={selectedClient} totalItems={totals.totalItems} subtotal={totals.subtotal} total={totals.total} saving={saving} onChangeQuantity={changeQuantity} onOpenClient={() => setClientVisible(true)} onDiscountChange={setDiscount} onNotesChange={setNotes} onConfirm={confirmSale} /></View></View>
      </Modal>

      <ClientSelectModal visible={clientVisible} selectedClient={selectedClient} onSelectClient={setSelectedClient} onClose={() => setClientVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F8F4EF' },
  content: { flex: 1 },
  desktopContent: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 1180 },
  catalogColumn: { flex: 1 },
  catalogColumnDesktop: { paddingRight: 16 },
  desktopCartColumn: { width: 370, paddingTop: 16, paddingRight: 16 },
  catalogList: { padding: 16, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  screenTitle: { color: '#291537', fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  screenSubtitle: { color: '#887C8C', fontSize: 13, marginTop: 3 },
  closeButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E6DCD2' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDFC', borderWidth: 1, borderColor: '#E6DCD2', borderRadius: 15, paddingHorizontal: 14, marginBottom: 22, minHeight: 50 },
  searchInput: { flex: 1, color: '#291537', fontSize: 14, marginLeft: 10, paddingVertical: 10 },
  catalogHeader: { marginBottom: 10 },
  catalogTitle: { color: '#291537', fontSize: 18, fontWeight: '800' },
  catalogHint: { color: '#887C8C', fontSize: 12, marginTop: 2 },
  catalogCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDFC', borderWidth: 1, borderColor: '#E6DCD2', borderRadius: 17, padding: 10, marginBottom: 10, boxShadow: '0px 2px 6px rgba(60, 34, 75, 0.05)', elevation: 1 },
  catalogImage: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#F3EAF7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imageFill: { width: '100%', height: '100%' },
  catalogInfo: { flex: 1, marginHorizontal: 12 },
  catalogName: { color: '#291537', fontSize: 15, fontWeight: '800' },
  catalogCategory: { color: '#887C8C', fontSize: 12, marginTop: 2 },
  catalogPrice: { color: '#5A3475', fontSize: 15, fontWeight: '800', marginTop: 5 },
  catalogStock: { color: '#23805B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  catalogStockOut: { color: '#A34E4E' },
  addProductButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#7651A7', justifyContent: 'center', alignItems: 'center' },
  addProductDisabled: { backgroundColor: '#EEE9E6' },
  noResults: { alignItems: 'center', padding: 40 },
  noResultsText: { color: '#887C8C', fontSize: 13, textAlign: 'center', marginTop: 10 },
  cartPanel: { backgroundColor: '#FFFDFC', borderWidth: 1, borderColor: '#E6DCD2', padding: 18 },
  desktopCartPanel: {},
  panelTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  panelTitle: { color: '#291537', fontSize: 20, fontWeight: '800' },
  panelSubtitle: { color: '#887C8C', fontSize: 12, marginTop: 2 },
  cartCountBadge: { backgroundColor: '#F0E8F8', minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: '#5A3475', fontWeight: '800', fontSize: 12 },
  cartLines: { marginBottom: 14 },
  cartLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0E8E2' },
  cartLineImage: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3EAF7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cartLineInfo: { flex: 1, marginHorizontal: 9 },
  cartLineName: { color: '#291537', fontSize: 12, fontWeight: '800' },
  cartLinePrice: { color: '#5A3475', fontSize: 12, fontWeight: '800', marginTop: 2 },
  cartLineStock: { color: '#887C8C', fontSize: 10, marginTop: 1 },
  lineQuantity: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lineQtyButton: { width: 25, height: 25, borderRadius: 8, backgroundColor: '#F0E8F8', justifyContent: 'center', alignItems: 'center' },
  lineQtyText: { color: '#291537', fontWeight: '800', fontSize: 12, minWidth: 12, textAlign: 'center' },
  emptyCart: { backgroundColor: '#FAF6F3', borderRadius: 14, padding: 22, alignItems: 'center', marginBottom: 14 },
  emptyCartTitle: { color: '#5A3475', fontWeight: '800', marginTop: 8 },
  emptyCartText: { color: '#887C8C', fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  fieldLabel: { color: '#5A4B60', fontSize: 12, fontWeight: '800', marginBottom: 7, marginTop: 8 },
  optional: { color: '#A69AA9', fontWeight: '500' },
  clientSelectorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF6F3', borderWidth: 1, borderColor: '#E6DCD2', borderRadius: 13, padding: 10, marginBottom: 5 },
  clientSelectorIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F0E8F8', justifyContent: 'center', alignItems: 'center', marginRight: 9 },
  clientSelectorInfo: { flex: 1 },
  clientSelectorTitle: { color: '#291537', fontSize: 12, fontWeight: '800' },
  clientSelectorSub: { color: '#887C8C', fontSize: 10, marginTop: 2 },
  inputWithPrefix: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E6DCD2', borderRadius: 13, backgroundColor: '#FFFDFC', paddingHorizontal: 12, minHeight: 43 },
  prefix: { color: '#887C8C', fontWeight: '800', marginRight: 7 },
  input: { color: '#291537', fontSize: 13, flex: 1, paddingVertical: 10 },
  notesInput: { borderWidth: 1, borderColor: '#E6DCD2', borderRadius: 13, backgroundColor: '#FFFDFC', paddingHorizontal: 12, minHeight: 52, textAlignVertical: 'top' },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0E8F8', borderRadius: 15, padding: 13, marginTop: 16, marginBottom: 12 },
  totalLabel: { color: '#5A3475', fontSize: 13, fontWeight: '800' },
  subtotalText: { color: '#7651A7', fontSize: 11, marginTop: 2 },
  totalAmount: { color: '#5A3475', fontSize: 21, fontWeight: '900' },
  confirmBtn: { minHeight: 48, borderRadius: 14, backgroundColor: '#7651A7', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, boxShadow: '0px 4px 8px rgba(90, 52, 117, 0.20)', elevation: 3 },
  disabledButton: { opacity: 0.55 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  mobileCartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFDFC', borderTopWidth: 1, borderTopColor: '#E6DCD2', paddingHorizontal: 16, paddingTop: 11, paddingBottom: Platform.OS === 'ios' ? 28 : 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0px -3px 8px rgba(60, 34, 75, 0.08)', elevation: 8 },
  mobileCartLabel: { color: '#887C8C', fontSize: 11 },
  mobileCartTotal: { color: '#291537', fontSize: 18, fontWeight: '900', marginTop: 2 },
  mobileCartButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7651A7', borderRadius: 13, paddingHorizontal: 15, paddingVertical: 12 },
  mobileCartButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(41, 21, 55, 0.35)', justifyContent: 'flex-end' },
  bottomSheet: { maxHeight: '92%', backgroundColor: '#F8F4EF', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingTop: 8 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D2C6D4', alignSelf: 'center', marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 2 },
  sheetTitle: { color: '#291537', fontSize: 18, fontWeight: '800' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F4EF', padding: 24 },
  loadingText: { color: '#887C8C', marginTop: 12, fontSize: 14 },
  emptyIconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#F0E8F8', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  noProductTitle: { color: '#291537', fontSize: 21, fontWeight: '800' },
  noProductSub: { color: '#887C8C', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7, marginBottom: 22, maxWidth: 330 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7651A7', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
