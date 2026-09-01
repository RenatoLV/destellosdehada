import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProducts } from '../../hooks/useProducts';
import { useCheckout } from '../../hooks/useCheckout';
import { ClientSelectModal } from '../../components/ClientSelectModal';
import { CheckoutProgress } from '../../components/pos/CheckoutProgress';
import { CheckoutSummary } from '../../components/pos/CheckoutSummary';
import { CheckoutFooter } from '../../components/pos/CheckoutFooter';
import { CheckoutStatus } from '../../components/pos/CheckoutStatus';
import { ReceiptPicker } from '../../components/pos/ReceiptPicker';
import { formatCurrency } from '../../domain/pos';
import { Product } from '../../types/database';
import { POSColors, POSRadius, POSTypography } from '../../constants/posTheme';
import { hasTransferInstructions, transferInstructions } from '../../constants/transferInstructions';

const TITLES = {
  cart: ['Nueva venta', 'Selecciona las piezas para este cobro'],
  client: ['Cliente', 'Asocia la venta o continúa sin cliente'],
  transfer: ['Transferencia', 'Confirma el monto antes de solicitar el pago'],
  receipt: ['Comprobante', 'Adjunta el respaldo de la transferencia'],
  processing: ['Procesando venta', 'Estamos guardando la operación de forma segura'],
  confirmation: ['Estado de la venta', 'Seguimiento local y sincronización'],
} as const;

const TRANSFER_FIELDS = [
  ['Banco', 'bankName'],
  ['Tipo de cuenta', 'accountType'],
  ['Número de cuenta', 'accountNumber'],
  ['Titular', 'accountHolder'],
  ['RUT', 'rut'],
  ['Email', 'email'],
] as const;

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const unavailable = product.stock <= 0;
  return (
    <Animated.View entering={FadeInUp.duration(240)} style={styles.productCard}>
      <View style={styles.productImage}>
        {product.image_uri
          ? <Image source={{ uri: product.image_uri }} style={styles.imageFill} />
          : <Feather name="circle" size={24} color={POSColors.lavender} />}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productMeta}>{product.sku || product.category_id || 'Joyería'}</Text>
        <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
        <Text style={[styles.stockText, unavailable && styles.dangerText]}>{unavailable ? 'Sin stock' : `${product.stock} disponibles`}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Agregar ${product.name}`}
        accessibilityHint={unavailable ? 'Producto sin stock disponible' : 'Agrega una unidad al carrito'}
        activeOpacity={0.82}
        style={[styles.addButton, unavailable && styles.buttonDisabled]}
        disabled={unavailable}
        onPress={onAdd}
      >
        <Feather name="plus" size={19} color={unavailable ? POSColors.muted : POSColors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NuevaVentaScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { products, loading: loadingProducts } = useProducts();
  const checkout = useCheckout();
  const [search, setSearch] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const initialProductHandled = useRef(false);

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const columns = isTablet ? 2 : 1;
  const step = checkout.session?.checkout.step ?? 'cart';
  const title = TITLES[step];

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(product => `${product.name} ${product.sku || ''} ${product.category_id || ''}`.toLowerCase().includes(query));
  }, [products, search]);

  useEffect(() => {
    if (initialProductHandled.current || !productId || !checkout.session || products.length === 0) return;
    const product = products.find(item => item.id === productId);
    if (product) checkout.addProduct(product);
    initialProductHandled.current = true;
  }, [checkout.addProduct, productId, products]);

  useEffect(() => {
    setDiscountInput(checkout.session?.discount.amount ? String(checkout.session.discount.amount) : '');
  }, [checkout.session?.discount.amount]);

  const handleBack = () => {
    if (step === 'cart') router.back();
    else checkout.backCheckout();
  };

  const handlePrimary = () => {
    if (step === 'receipt') void checkout.submit();
    else checkout.continueCheckout();
  };

  const syncLabel = checkout.sync.isSyncing
    ? 'Sincronizando'
    : !checkout.sync.isOnline
      ? 'Sin conexión · puedes seguir vendiendo'
      : checkout.sync.blockedCount > 0
        ? 'Requiere atención'
        : checkout.sync.pendingCount > 0
          ? `${checkout.sync.pendingCount} pendiente${checkout.sync.pendingCount === 1 ? '' : 's'}`
          : 'En línea';

  if (checkout.initializing || loadingProducts) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <View style={styles.loadingMark}><Feather name="circle" size={30} color={POSColors.plum} /></View>
        <ActivityIndicator color={POSColors.plum} />
        <Text style={styles.loadingText}>Preparando tu punto de venta…</Text>
      </SafeAreaView>
    );
  }

  if (!checkout.session) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <View style={[styles.loadingMark, styles.dangerMark]}><Feather name="briefcase" size={28} color={POSColors.danger} /></View>
        <Text style={styles.emptyTitle}>No hay una organización activa</Text>
        <Text style={styles.emptyDescription}>{checkout.message || 'Selecciona una organización antes de realizar una venta.'}</Text>
        <TouchableOpacity style={styles.softButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={styles.softButtonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const session = checkout.session;
  const isTerminal = step === 'processing' || step === 'confirmation';
  const primaryDisabled = step === 'cart'
    ? session.cart.length === 0
    : step === 'receipt'
      ? !checkout.receipt || checkout.submitting
      : isTerminal;

  const cartHeader = (
    <View>
      <View style={styles.searchBox}>
        <Feather name="search" size={17} color={POSColors.lavender} />
        <TextInput accessibilityLabel="Buscar productos" style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar joya, SKU o categoría" placeholderTextColor="#A195A4" />
        {search.length > 0 && <TouchableOpacity accessibilityLabel="Limpiar búsqueda" onPress={() => setSearch('')} style={styles.iconTouch}><Feather name="x" size={16} color={POSColors.muted} /></TouchableOpacity>}
      </View>

      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionEyebrow}>TU SELECCIÓN</Text><Text style={styles.sectionTitle}>Productos seleccionados</Text></View>
        <View style={styles.countPill}><Text style={styles.countText}>{checkout.totals.totalItems}</Text></View>
      </View>

      {session.cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <View style={styles.emptyIcon}><Feather name="shopping-bag" size={24} color={POSColors.lavender} /></View>
          <Text style={styles.emptyCartTitle}>Tu carrito está listo para comenzar</Text>
          <Text style={styles.emptyCartText}>Agrega una pieza del catálogo para preparar el cobro.</Text>
        </View>
      ) : session.cart.map(item => (
        <View key={item.product.id} style={styles.cartItem}>
          <View style={styles.cartThumb}>
            {item.product.image_uri ? <Image source={{ uri: item.product.image_uri }} style={styles.imageFill} /> : <Feather name="circle" size={18} color={POSColors.lavender} />}
          </View>
          <View style={styles.cartInfo}>
            <Text style={styles.cartName} numberOfLines={1}>{item.product.name}</Text>
            <Text style={styles.cartPrice}>{formatCurrency(item.unitPrice)} · {item.availableStock} disponibles</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Reducir ${item.product.name}`} style={styles.quantityButton} onPress={() => checkout.changeQuantity(item.product.id, -1)}><Feather name="minus" size={15} color={POSColors.plum} /></TouchableOpacity>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Aumentar ${item.product.name}`} style={styles.quantityButton} onPress={() => checkout.changeQuantity(item.product.id, 1)}><Feather name="plus" size={15} color={POSColors.plum} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar ${item.product.name}`} style={styles.removeButton} onPress={() => checkout.removeProduct(item.product.id)}><Feather name="trash-2" size={15} color={POSColors.danger} /></TouchableOpacity>
            </View>
          </View>
          <Text style={styles.cartAmount}>{formatCurrency(item.unitPrice * item.quantity)}</Text>
        </View>
      ))}

      {session.cart.length > 0 && (
        <View style={styles.discountCard}>
          <View style={styles.discountHeader}><View><Text style={styles.fieldTitle}>Descuento</Text><Text style={styles.fieldHint}>Monto fijo en CLP</Text></View><Feather name="tag" size={18} color={POSColors.gold} /></View>
          <View style={styles.discountRow}>
            <View style={styles.moneyInput}><Text style={styles.moneyPrefix}>$</Text><TextInput accessibilityLabel="Monto del descuento" value={discountInput} onChangeText={setDiscountInput} keyboardType="numeric" placeholder="0" placeholderTextColor="#A195A4" style={styles.moneyField} /></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Aplicar descuento" style={styles.applyButton} onPress={() => checkout.applyDiscount(discountInput)}><Text style={styles.applyText}>Aplicar</Text></TouchableOpacity>
          </View>
          <TextInput accessibilityLabel="Nota de la venta" value={session.notes} onChangeText={checkout.setNotes} placeholder="Nota opcional para esta venta" placeholderTextColor="#A195A4" style={styles.notesInput} />
          <View style={styles.inlineTotals}>
            <View style={styles.totalLine}><Text style={styles.totalMuted}>Subtotal</Text><Text style={styles.totalValue}>{formatCurrency(checkout.totals.subtotal)}</Text></View>
            <View style={styles.totalLine}><Text style={styles.totalMuted}>Descuento</Text><Text style={styles.discountValue}>− {formatCurrency(checkout.totals.discount)}</Text></View>
            <View style={[styles.totalLine, styles.totalMain]}><Text style={styles.totalMainLabel}>Total</Text><Text style={styles.totalMainValue}>{formatCurrency(checkout.totals.total)}</Text></View>
          </View>
        </View>
      )}

      <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>CATÁLOGO LOCAL</Text><Text style={styles.sectionTitle}>Agrega otra pieza</Text></View></View>
    </View>
  );

  const cartContent = (
    <FlatList
      style={styles.stepScroll}
      key={`catalog-${columns}`}
      data={filteredProducts}
      numColumns={columns}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <View style={[styles.productColumn, columns > 1 && styles.productColumnMulti]}><ProductCard product={item} onAdd={() => checkout.addProduct(item)} /></View>}
      ListHeaderComponent={cartHeader}
      ListEmptyComponent={<View style={styles.emptyCart}><Feather name="search" size={23} color={POSColors.lavender} /><Text style={styles.emptyCartTitle}>No encontramos productos</Text></View>}
      contentContainerStyle={styles.scrollContent}
      columnWrapperStyle={columns > 1 ? styles.productGridRow : undefined}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );

  const clientContent = (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepIntro}><Text style={styles.stepEyebrow}>PASO 2</Text><Text style={styles.stepTitle}>¿A quién corresponde esta venta?</Text><Text style={styles.stepDescription}>El cliente es opcional. Puedes continuar como venta rápida.</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continuar sin cliente" style={[styles.clientCard, !session.client && styles.clientCardSelected]} onPress={() => checkout.setClient(null)}>
        <View style={styles.clientIcon}><Feather name="zap" size={19} color={POSColors.plum} /></View>
        <View style={styles.clientInfo}><Text style={styles.clientName}>Sin cliente</Text><Text style={styles.clientMeta}>Venta rápida, sin datos personales asociados</Text></View>
        {!session.client && <Feather name="check-circle" size={21} color={POSColors.success} />}
      </TouchableOpacity>
      {session.client && (
        <View style={[styles.clientCard, styles.clientCardSelected]}>
          <View style={styles.clientAvatar}><Text style={styles.clientInitial}>{session.client.name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.clientInfo}><Text style={styles.clientName}>{session.client.name}</Text><Text style={styles.clientMeta}>{session.client.phone || session.client.rut || 'Cliente registrado'}</Text></View>
          <Feather name="check-circle" size={21} color={POSColors.success} />
        </View>
      )}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buscar o registrar cliente" accessibilityHint="Abre la selección de clientes" style={styles.outlineButton} onPress={() => setClientModalVisible(true)}>
        <Feather name="users" size={18} color={POSColors.plum} /><Text style={styles.outlineButtonText}>{session.client ? 'Cambiar cliente' : 'Buscar cliente'}</Text><Feather name="arrow-right" size={16} color={POSColors.plum} />
      </TouchableOpacity>
    </ScrollView>
  );

  const transferContent = (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepIntro}><Text style={styles.stepEyebrow}>PAGO POR TRANSFERENCIA</Text><Text style={styles.stepTitle}>Total a transferir</Text></View>
      <View style={styles.transferAmountCard}><Text style={styles.transferLabel}>MONTO EXACTO</Text><Text style={styles.transferAmount}>{formatCurrency(checkout.totals.total)}</Text><Text style={styles.transferHint}>El backend validará el precio final al sincronizar.</Text></View>
      <View style={styles.bankCard}>
        <View style={styles.bankHeader}><View style={styles.bankIcon}><Feather name="briefcase" size={20} color={POSColors.gold} /></View><View><Text style={styles.bankTitle}>Datos bancarios</Text><Text style={styles.bankSubtitle}>Información de la tienda</Text></View></View>
        {hasTransferInstructions() ? (
          <View style={styles.bankDetails}>
            {TRANSFER_FIELDS.map(([label, key]) => (
              <View key={key} style={styles.bankDetailRow} accessible accessibilityLabel={`${label}: ${transferInstructions[key]}`}>
                <Text style={styles.bankDetailLabel}>{label}</Text>
                <Text selectable style={styles.bankDetailValue}>{transferInstructions[key]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.unconfigured}><Feather name="info" size={18} color={POSColors.warning} /><Text style={styles.unconfiguredText}>Los datos bancarios aún no están configurados. Puedes continuar preparando la venta, pero confirma la información de pago antes de solicitar la transferencia.</Text></View>
        )}
      </View>
    </ScrollView>
  );

  const receiptContent = (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepIntro}><Text style={styles.stepEyebrow}>RESPALDO DEL PAGO</Text><Text style={styles.stepTitle}>Comprobante de transferencia</Text><Text style={styles.stepDescription}>El archivo se guardará localmente y solo se subirá después de confirmar la venta.</Text></View>
      <ReceiptPicker receipt={checkout.receipt} onSelect={checkout.selectReceipt} onRemove={checkout.removeReceipt} disabled={checkout.submitting} />
      <View style={styles.securityNote}><Feather name="lock" size={17} color={POSColors.success} /><Text style={styles.securityText}>Se almacenará en un bucket privado. Nunca se generará una URL pública.</Text></View>
    </ScrollView>
  );

  const processingContent = (
    <View style={styles.processing}>
      <View style={styles.processingRing}><ActivityIndicator size="large" color={POSColors.plum} /></View>
      <Text style={styles.processingTitle}>Procesando venta…</Text>
      <Text style={styles.processingText}>No cierres la aplicación. Primero guardaremos la operación en este dispositivo.</Text>
      <View style={styles.processingBadge}><Feather name="shield" size={16} color={POSColors.success} /><Text style={styles.processingBadgeText}>Protección contra doble cobro activa</Text></View>
    </View>
  );

  const confirmationContent = (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <CheckoutStatus
        status={session.checkout.saleStatus ?? 'pending'}
        total={checkout.totals.total}
        clientName={session.client?.name ?? null}
        receiptStatus={checkout.receiptStatus}
        conflictCode={session.checkout.conflictCode}
        conflictMessage={session.checkout.conflictMessage}
        isOnline={checkout.sync.isOnline}
        onNewSale={checkout.reset}
        onViewSales={() => router.replace('/(tabs)/ventas')}
      />
    </ScrollView>
  );

  const mainContent = step === 'cart' ? cartContent
    : step === 'client' ? clientContent
      : step === 'transfer' ? transferContent
        : step === 'receipt' ? receiptContent
          : step === 'processing' ? processingContent
            : confirmationContent;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" accessibilityHint="Regresa al paso anterior" style={[styles.backButton, isTerminal && styles.buttonDisabled]} onPress={handleBack} disabled={isTerminal}>
              <Feather name="arrow-left" size={19} color={POSColors.ink} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>{title[0]}</Text><Text style={styles.headerSubtitle}>{title[1]}</Text></View>
            <View style={[styles.syncPill, !checkout.sync.isOnline && styles.syncPillOffline, checkout.sync.blockedCount > 0 && styles.syncPillDanger]}>
              {checkout.sync.isSyncing ? <ActivityIndicator size="small" color={POSColors.plum} /> : <View style={[styles.syncDot, !checkout.sync.isOnline && styles.syncDotOffline, checkout.sync.blockedCount > 0 && styles.syncDotDanger]} />}
              {width >= 390 && <Text style={styles.syncText} numberOfLines={1}>{syncLabel}</Text>}
            </View>
          </View>
          <CheckoutProgress step={step} compact={!isTablet} />
        </View>

        {checkout.message && <View style={styles.messageBanner}><Feather name="info" size={16} color={POSColors.warning} /><Text style={styles.messageText}>{checkout.message}</Text></View>}

        <View style={[styles.workspace, isDesktop && styles.workspaceDesktop]}>
          <Animated.View key={step} entering={FadeInRight.duration(260)} style={styles.mainColumn}>
            {mainContent}
            {!isDesktop && !isTerminal && <CheckoutFooter total={checkout.totals.total} label={step === 'receipt' ? 'Registrar venta' : 'Continuar'} onPress={handlePrimary} disabled={primaryDisabled} loading={checkout.submitting} />}
          </Animated.View>
          {isDesktop && !isTerminal && (
            <View style={styles.summaryColumn}>
              <CheckoutSummary cart={session.cart} totals={checkout.totals} client={session.client} receipt={checkout.receipt} />
              <CheckoutFooter total={checkout.totals.total} label={step === 'receipt' ? 'Registrar venta' : 'Continuar'} onPress={handlePrimary} disabled={primaryDisabled} loading={checkout.submitting} showTotal={false} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      <ClientSelectModal visible={clientModalVisible} selectedClient={session.client} onSelectClient={checkout.setClient} onClose={() => setClientModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { flex: 1, backgroundColor: POSColors.background }, workspace: { flex: 1 }, mainColumn: { flex: 1, minWidth: 0 }, stepScroll: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: POSColors.background, alignItems: 'center', justifyContent: 'center', padding: 26 },
  loadingMark: { width: 68, height: 68, borderRadius: 34, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  dangerMark: { backgroundColor: POSColors.dangerSoft }, loadingText: { marginTop: 12, color: POSColors.muted, fontSize: 13 },
  emptyTitle: { fontFamily: POSTypography.serif, color: POSColors.ink, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { color: POSColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 380, marginTop: 9 },
  softButton: { marginTop: 20, minHeight: 48, minWidth: 150, borderRadius: POSRadius.medium, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center' }, softButtonText: { color: POSColors.plum, fontWeight: '900' },
  header: { backgroundColor: POSColors.surface, borderBottomWidth: 1, borderBottomColor: POSColors.border, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 13, zIndex: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', maxWidth: 1180, width: '100%', alignSelf: 'center', marginBottom: 14 },
  backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: POSColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: POSColors.surface },
  headerTitleWrap: { flex: 1, marginHorizontal: 12 }, headerTitle: { fontFamily: POSTypography.serif, color: POSColors.ink, fontSize: 23, fontWeight: '800' }, headerSubtitle: { color: POSColors.muted, fontSize: 11, marginTop: 2 },
  syncPill: { minHeight: 34, maxWidth: 220, borderRadius: POSRadius.pill, paddingHorizontal: 11, backgroundColor: POSColors.successSoft, flexDirection: 'row', alignItems: 'center', gap: 7 }, syncPillOffline: { backgroundColor: POSColors.warningSoft }, syncPillDanger: { backgroundColor: POSColors.dangerSoft },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: POSColors.success }, syncDotOffline: { backgroundColor: POSColors.warning }, syncDotDanger: { backgroundColor: POSColors.danger }, syncText: { color: POSColors.ink, fontSize: 10, fontWeight: '800' },
  messageBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: POSColors.warningSoft, borderBottomWidth: 1, borderBottomColor: '#EED8B6' }, messageText: { flex: 1, color: POSColors.warning, fontSize: 11, fontWeight: '700' },
  workspaceDesktop: { flexDirection: 'row', width: '100%', maxWidth: 1180, alignSelf: 'center', gap: 22, paddingHorizontal: 20 }, summaryColumn: { width: 350, paddingVertical: 20, gap: 14 },
  scrollContent: { padding: 16, paddingBottom: 30, maxWidth: 820, width: '100%', alignSelf: 'center' },
  searchBox: { minHeight: 50, borderRadius: POSRadius.medium, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 }, searchInput: { flex: 1, color: POSColors.ink, fontSize: 13, paddingVertical: 12 }, iconTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }, sectionEyebrow: { color: POSColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, sectionTitle: { fontFamily: POSTypography.serif, color: POSColors.ink, fontSize: 22, fontWeight: '800', marginTop: 4 },
  countPill: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 }, countText: { color: POSColors.plum, fontSize: 12, fontWeight: '900' },
  emptyCart: { borderRadius: POSRadius.large, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, padding: 24, alignItems: 'center', marginBottom: 8 }, emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center' }, emptyCartTitle: { color: POSColors.ink, fontSize: 14, fontWeight: '800', marginTop: 11, textAlign: 'center' }, emptyCartText: { color: POSColors.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  cartItem: { minHeight: 104, position: 'relative', borderRadius: POSRadius.medium, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, cartThumb: { width: 64, height: 64, borderRadius: 15, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, imageFill: { width: '100%', height: '100%' },
  cartInfo: { flex: 1, marginLeft: 12, minWidth: 0 }, cartName: { color: POSColors.ink, fontSize: 13, fontWeight: '900', paddingRight: 74 }, cartPrice: { color: POSColors.muted, fontSize: 10, marginTop: 3 }, quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }, quantityButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center' }, quantity: { color: POSColors.ink, fontSize: 13, fontWeight: '900', minWidth: 18, textAlign: 'center' }, removeButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: POSColors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginLeft: 1 }, cartAmount: { position: 'absolute', right: 12, top: 14, color: POSColors.plum, fontFamily: POSTypography.serif, fontSize: 15, fontWeight: '900' },
  discountCard: { borderRadius: POSRadius.large, padding: 16, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, marginTop: 6 }, discountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, fieldTitle: { color: POSColors.ink, fontSize: 13, fontWeight: '900' }, fieldHint: { color: POSColors.muted, fontSize: 10, marginTop: 2 }, discountRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  moneyInput: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: POSColors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, moneyPrefix: { color: POSColors.gold, fontSize: 15, fontWeight: '900' }, moneyField: { flex: 1, color: POSColors.ink, fontSize: 14, paddingHorizontal: 8, paddingVertical: 10 }, applyButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 13, backgroundColor: POSColors.goldSoft, alignItems: 'center', justifyContent: 'center' }, applyText: { color: '#79571D', fontSize: 12, fontWeight: '900' }, notesInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: POSColors.border, color: POSColors.ink, fontSize: 12, paddingHorizontal: 12, marginTop: 10 },
  inlineTotals: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: POSColors.border, gap: 8 }, totalLine: { flexDirection: 'row', justifyContent: 'space-between' }, totalMuted: { color: POSColors.muted, fontSize: 11 }, totalValue: { color: POSColors.ink, fontSize: 11, fontWeight: '800' }, discountValue: { color: POSColors.success, fontSize: 11, fontWeight: '800' }, totalMain: { paddingTop: 8, marginTop: 2, borderTopWidth: 1, borderTopColor: POSColors.border, alignItems: 'center' }, totalMainLabel: { color: POSColors.ink, fontSize: 14, fontWeight: '900' }, totalMainValue: { color: POSColors.plum, fontFamily: POSTypography.serif, fontSize: 23, fontWeight: '900' },
  productGridRow: { gap: 10 }, productColumn: { flex: 1 }, productColumnMulti: { minWidth: 0 }, productCard: { minHeight: 105, borderRadius: POSRadius.medium, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, productImage: { width: 66, height: 66, borderRadius: 15, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, productInfo: { flex: 1, marginHorizontal: 11, minWidth: 0 }, productName: { color: POSColors.ink, fontSize: 13, fontWeight: '900' }, productMeta: { color: POSColors.muted, fontSize: 9, marginTop: 2 }, productPrice: { color: POSColors.plum, fontSize: 13, fontWeight: '900', marginTop: 5 }, stockText: { color: POSColors.success, fontSize: 9, fontWeight: '800', marginTop: 2 }, dangerText: { color: POSColors.danger }, addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: POSColors.plum, alignItems: 'center', justifyContent: 'center' }, buttonDisabled: { opacity: 0.45 },
  stepIntro: { marginBottom: 22 }, stepEyebrow: { color: POSColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, stepTitle: { fontFamily: POSTypography.serif, color: POSColors.ink, fontSize: 29, fontWeight: '800', marginTop: 6 }, stepDescription: { color: POSColors.muted, fontSize: 12, lineHeight: 19, marginTop: 7, maxWidth: 520 },
  clientCard: { minHeight: 78, borderRadius: POSRadius.medium, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, clientCardSelected: { borderColor: '#BFA7CB', backgroundColor: '#FBF8FC' }, clientIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center' }, clientAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: POSColors.roseSoft, alignItems: 'center', justifyContent: 'center' }, clientInitial: { color: POSColors.rose, fontSize: 17, fontWeight: '900' }, clientInfo: { flex: 1, marginHorizontal: 12 }, clientName: { color: POSColors.ink, fontSize: 14, fontWeight: '900' }, clientMeta: { color: POSColors.muted, fontSize: 10, marginTop: 3 },
  outlineButton: { minHeight: 52, borderRadius: POSRadius.medium, borderWidth: 1, borderColor: '#CBB8D3', backgroundColor: POSColors.plumSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }, outlineButtonText: { color: POSColors.plum, fontSize: 13, fontWeight: '900' },
  transferAmountCard: { borderRadius: POSRadius.large, backgroundColor: POSColors.plum, padding: 26, alignItems: 'center', boxShadow: '0px 12px 28px rgba(77, 42, 96, 0.18)' }, transferLabel: { color: '#DCCCE4', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, transferAmount: { color: POSColors.white, fontFamily: POSTypography.serif, fontSize: 39, fontWeight: '900', marginTop: 8 }, transferHint: { color: '#DCCCE4', fontSize: 10, marginTop: 9, textAlign: 'center' },
  bankCard: { borderRadius: POSRadius.large, backgroundColor: POSColors.surface, borderWidth: 1, borderColor: POSColors.border, padding: 18, marginTop: 15 }, bankHeader: { flexDirection: 'row', alignItems: 'center' }, bankIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: POSColors.goldSoft, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, bankTitle: { color: POSColors.ink, fontSize: 15, fontWeight: '900' }, bankSubtitle: { color: POSColors.muted, fontSize: 10, marginTop: 2 }, bankDetails: { marginTop: 16, borderTopWidth: 1, borderTopColor: POSColors.border }, bankDetailRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: POSColors.border }, bankDetailLabel: { color: POSColors.muted, fontSize: 10, fontWeight: '700' }, bankDetailValue: { flex: 1, color: POSColors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' }, unconfigured: { flexDirection: 'row', gap: 10, borderRadius: 13, backgroundColor: POSColors.warningSoft, padding: 13, marginTop: 16 }, unconfiguredText: { flex: 1, color: POSColors.warning, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  securityNote: { flexDirection: 'row', gap: 9, borderRadius: POSRadius.medium, backgroundColor: POSColors.successSoft, padding: 14, marginTop: 13 }, securityText: { flex: 1, color: POSColors.success, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 }, processingRing: { width: 82, height: 82, borderRadius: 41, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center' }, processingTitle: { fontFamily: POSTypography.serif, color: POSColors.ink, fontSize: 29, fontWeight: '800', marginTop: 20 }, processingText: { color: POSColors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', maxWidth: 380, marginTop: 8 }, processingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: POSRadius.pill, backgroundColor: POSColors.successSoft, paddingHorizontal: 14, paddingVertical: 9, marginTop: 18 }, processingBadgeText: { color: POSColors.success, fontSize: 10, fontWeight: '800' },
});
