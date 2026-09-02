import { ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/Toast';
import { WelcomeHero } from '@/components/sales/WelcomeHero';
import { ProductCard } from '@/components/sales/ProductCard';
import { MOCK_PRODUCTS, type Product } from '@/data/mockProducts';

const CATEGORIES = [
  { name: 'Anillos', icon: 'circle' as const, copy: 'Piezas que cuentan historias' },
  { name: 'Collares', icon: 'sun' as const, copy: 'Un detalle cerca del corazón' },
  { name: 'Pulseras', icon: 'link-2' as const, copy: 'Elegancia para cada día' },
  { name: 'Aros', icon: 'disc' as const, copy: 'Luz para enmarcar tu rostro' },
  { name: 'Perfumes', icon: 'droplet' as const, copy: 'Aromas que dejan una impresión' },
  { name: 'Ropa', icon: 'layers' as const, copy: 'Prendas versátiles y femeninas' },
];

const SERVICES = [
  { icon: 'award' as const, title: 'Selección con intención', desc: 'Joyas, aromas y prendas escogidos con especial cuidado.' },
  { icon: 'package' as const, title: 'Listo para regalar', desc: 'Cada producto llega en un empaque cuidado.' },
  { icon: 'truck' as const, title: 'Despachos a todo Chile', desc: 'Seguimiento y entrega segura desde Coquimbo.' },
  { icon: 'message-circle' as const, title: 'Atención cercana', desc: 'Te ayudamos personalmente antes y después de comprar.' },
];

export default function HubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { addProduct } = useCart();
  const toast = useToast();
  const isMobile = width < 720;

  const addFromHome = (product: Product) => {
    addProduct(product);
    toast.show({ message: `${product.name} se agregó a tu selección`, type: 'success' });
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={[styles.heroWrap, isMobile && styles.heroWrapMobile]}>
        <WelcomeHero onExplore={() => router.push('/venta')} />
      </View>

      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View style={styles.sectionIntro}>
          <Text style={styles.kicker}>ENCUENTRA TU FAVORITO</Text>
          <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Explora la colección</Text>
          <Text style={styles.sectionLead}>Joyas, perfumes y prendas escogidas para acompañarte y regalar con intención.</Text>
        </View>
        {isMobile ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={254}
            snapToAlignment="start"
            contentContainerStyle={styles.categoryRail}
          >
          {CATEGORIES.map((category, index) => (
            <Pressable key={category.name} onPress={() => router.push(`/venta?category=${category.name}`)} style={({ hovered, pressed }) => [styles.categoryCard, (hovered || pressed) && styles.categoryCardActive, isMobile && styles.categoryCardMobile]}>
              <View style={styles.categoryNumber}><Text style={styles.categoryNumberText}>0{index + 1}</Text></View>
              <View style={styles.categoryIcon}><Feather name={category.icon} size={21} color={theme.colors.primary} /></View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCopy}>{category.copy}</Text>
              <Feather name="arrow-up-right" size={16} color={theme.colors.textSecondary} style={styles.categoryArrow} />
            </Pressable>
          ))}
          </ScrollView>
        ) : (
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((category, index) => (
              <Pressable key={category.name} onPress={() => router.push(`/venta?category=${category.name}`)} style={({ hovered, pressed }) => [styles.categoryCard, (hovered || pressed) && styles.categoryCardActive]}>
                <View style={styles.categoryNumber}><Text style={styles.categoryNumberText}>0{index + 1}</Text></View>
                <View style={styles.categoryIcon}><Feather name={category.icon} size={21} color={theme.colors.primary} /></View>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCopy}>{category.copy}</Text>
                <Feather name="arrow-up-right" size={16} color={theme.colors.textSecondary} style={styles.categoryArrow} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, styles.productsSection, isMobile && styles.sectionMobile]}>
        <View style={styles.sectionHeader}>
          <View><Text style={styles.kicker}>RECIÉN LLEGADAS</Text><Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Nuevas historias</Text></View>
          <Pressable onPress={() => router.push('/venta')} style={styles.textLink}>
            <Text style={styles.textLinkLabel}>Ver toda la colección</Text><Feather name="arrow-right" size={15} color={theme.colors.primary} />
          </Pressable>
        </View>
        <View style={styles.productGrid}>
          {MOCK_PRODUCTS.filter((product) => ['1', '2', '11', '14'].includes(product.id)).map((product, index) => (
            <View key={product.id} style={[styles.productCell, isMobile && styles.productCellMobile]}>
              <ProductCard product={product} index={index} onAdd={addFromHome} onQuickView={() => router.push('/venta')} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.serviceBand}>
        <View style={styles.serviceGrid}>
          {SERVICES.map((item) => (
            <View key={item.title} style={[styles.serviceItem, isMobile && styles.serviceItemMobile]}>
              <Feather name={item.icon} size={20} color={theme.colors.champagne} />
              <View style={styles.serviceText}><Text style={styles.serviceTitle}>{item.title}</Text><Text style={styles.serviceDesc}>{item.desc}</Text></View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.localSection, isMobile && styles.localSectionMobile]}>
        <View style={styles.localCopy}>
          <Text style={styles.kicker}>NUESTRA CASA</Text>
          <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Desde Coquimbo,{`\n`}con dedicación.</Text>
          <Text style={styles.localLead}>Somos una boutique local. Seleccionamos cada producto y acompañamos personalmente cada compra.</Text>
          <Pressable onPress={() => typeof window !== 'undefined' && window.open('https://wa.me/56997310398', '_blank')} style={styles.contactLink}>
            <View style={styles.contactIcon}><Feather name="message-circle" size={18} color={theme.colors.primary} /></View>
            <View style={{ flex: 1 }}><Text style={styles.contactLabel}>¿Necesitas ayuda?</Text><Text style={styles.contactValue}>Conversemos por WhatsApp</Text></View>
            <Feather name="arrow-up-right" size={16} color={theme.colors.primary} />
          </Pressable>
        </View>
        <View style={styles.mapWrap}>
          {typeof window !== 'undefined' ? <iframe src="https://maps.google.com/maps?q=-29.9974,-71.3254&z=15&output=embed" width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="Ubicación Destellos de Hada" /> : <Feather name="map-pin" size={34} color={theme.colors.primary} />}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FBF5EB' }, pageContent: { paddingBottom: 72 },
  heroWrap: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 32 }, heroWrapMobile: { paddingHorizontal: 14, paddingTop: 14 },
  section: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 88 }, sectionIntro: { alignItems: 'center', marginBottom: 36 },
  sectionMobile: { paddingHorizontal: 16, paddingTop: 64 },
  kicker: { color: '#6F2138', fontSize: 10.5, fontWeight: '800', letterSpacing: 2.4, marginBottom: 10 },
  sectionTitle: { color: '#21191C', fontFamily: 'Cormorant Garamond', fontSize: 38, lineHeight: 43, letterSpacing: -0.5 }, sectionTitleMobile: { fontSize: 32, lineHeight: 36 },
  sectionLead: { color: '#65575B', fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 520, marginTop: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  categoryRail: { gap: 14, paddingRight: 18, paddingBottom: 6 },
  categoryCard: { flex: 0, width: '31.8%', minWidth: 200, minHeight: 210, padding: 22, borderRadius: 12, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: 'rgba(84,24,43,0.12)', position: 'relative' },
  categoryCardMobile: { flex: 0, width: 240, minHeight: 196, padding: 20 }, categoryCardActive: { borderColor: 'rgba(84,24,43,0.3)', transform: [{ translateY: -3 }] },
  categoryNumber: { position: 'absolute', top: 18, right: 18 }, categoryNumberText: { color: '#8A7C80', fontSize: 10, letterSpacing: 1 },
  categoryIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3E9DA', alignItems: 'center', justifyContent: 'center', marginBottom: 34 },
  categoryName: { color: '#21191C', fontFamily: 'Cormorant Garamond', fontSize: 23, fontWeight: '600' }, categoryCopy: { color: '#65575B', fontSize: 12, lineHeight: 18, marginTop: 6, paddingRight: 15 }, categoryArrow: { position: 'absolute', bottom: 20, right: 20 },
  productsSection: { paddingTop: 96 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20, marginBottom: 30 },
  textLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, textLinkLabel: { color: '#54182B', fontSize: 13, fontWeight: '700' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, productCell: { flex: 1, minWidth: 190, maxWidth: 290 }, productCellMobile: { minWidth: '46%', maxWidth: '50%' },
  serviceBand: { backgroundColor: '#2A0C16', marginTop: 96, paddingVertical: 38, paddingHorizontal: 32 }, serviceGrid: { width: '100%', maxWidth: 1180, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  serviceItem: { flex: 1, minWidth: 210, flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, serviceItemMobile: { minWidth: '100%' }, serviceText: { flex: 1 },
  serviceTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 4 }, serviceDesc: { color: 'rgba(255,255,255,0.62)', fontSize: 11.5, lineHeight: 17 },
  localSection: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 96, flexDirection: 'row', gap: 64, alignItems: 'center' },
  localSectionMobile: { flexDirection: 'column', gap: 32, paddingHorizontal: 20, paddingTop: 72, alignItems: 'stretch' }, localCopy: { flex: 1 },
  localLead: { color: '#65575B', fontSize: 14, lineHeight: 23, maxWidth: 460, marginTop: 18 },
  contactLink: { marginTop: 28, maxWidth: 340, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(84,24,43,0.14)', paddingVertical: 12 },
  contactIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3E9DA', alignItems: 'center', justifyContent: 'center' }, contactLabel: { color: '#8A7C80', fontSize: 10.5 }, contactValue: { color: '#54182B', fontSize: 13, fontWeight: '700', marginTop: 2 },
  mapWrap: { flex: 1.1, minHeight: 350, borderRadius: 14, overflow: 'hidden', backgroundColor: '#EAE4D9', alignItems: 'center', justifyContent: 'center' },
});
