import { useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CartBottomSheet } from '@/components/sales/CartBottomSheet';
import BottomSheet from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useCart } from '@/context/CartContext';
import { SearchBar } from '@/components/sales/SearchBar';
import { FilterChips } from '@/components/sales/FilterChips';
import { ProductGrid } from '@/components/sales/ProductGrid';
import { ProductCard } from '@/components/sales/ProductCard';
import { CartPanel } from '@/components/sales/CartPanel';
import { CartFloatingBar } from '@/components/sales/CartFloatingBar';
import { ProductQuickView } from '@/components/sales/ProductQuickView';
import { MobileFilterSheet, type AvailabilityFilter } from '@/components/sales/MobileFilterSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useToast } from '@/components/ui/Toast';
import { MOCK_PRODUCTS, type Product } from '@/data/mockProducts';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

const CATEGORY_OPTIONS = ['Todas', 'Favoritos', 'Anillos', 'Collares', 'Pulseras', 'Aros', 'Perfumes', 'Ropa'];

export default function VentaScreen() {
  const theme = useTheme();
  const deviceClass = useDeviceClass();
  const isDesktop = deviceClass === 'desktop';
  const { lines, addProduct, removeProduct } = useCart();
  const { favorites } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(
    params.category && typeof params.category === 'string' && CATEGORY_OPTIONS.includes(params.category)
      ? params.category
      : 'Todas'
  );
  const [desktopCartOpen, setDesktopCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [availability, setAvailability] = useState<AvailabilityFilter>('Todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Allow URL parameter to change category if it updates
  useEffect(() => {
    if (params.category && typeof params.category === 'string' && CATEGORY_OPTIONS.includes(params.category)) {
      setCategory(params.category);
    }
  }, [params.category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_PRODUCTS.filter((p) => {
      const matchesCategory =
        category === 'Todas'
          ? true
          : category === 'Favoritos'
          ? favorites.includes(p.id)
          : p.category === category;

      const matchesQuery =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesAvailability =
        availability === 'Todas' ||
        (availability === 'Disponibles' && p.availability === 'disponible') ||
        (availability === 'Últimas unidades' && p.availability === 'ultimas_unidades') ||
        (availability === 'Agotados' && p.availability === 'agotado');
      return matchesCategory && matchesQuery && matchesAvailability;
    });
  }, [query, category, availability, favorites]);

  const countForFilters = (nextCategory: string, nextAvailability: AvailabilityFilter) => {
    const q = query.trim().toLowerCase();
    return MOCK_PRODUCTS.filter((product) => {
      const categoryMatches = nextCategory === 'Todas'
        ? true
        : nextCategory === 'Favoritos'
          ? favorites.includes(product.id)
          : product.category === nextCategory;
      const searchMatches = q.length === 0 ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.material.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q);
      const availabilityMatches = nextAvailability === 'Todas' ||
        (nextAvailability === 'Disponibles' && product.availability === 'disponible') ||
        (nextAvailability === 'Últimas unidades' && product.availability === 'ultimas_unidades') ||
        (nextAvailability === 'Agotados' && product.availability === 'agotado');
      return categoryMatches && searchMatches && availabilityMatches;
    }).length;
  };

  const categoryCounts = useMemo(() => Object.fromEntries(
    CATEGORY_OPTIONS.map((option) => [
      option,
      option === 'Todas' ? MOCK_PRODUCTS.length : option === 'Favoritos' ? favorites.length : MOCK_PRODUCTS.filter((product) => product.category === option).length,
    ])
  ), [favorites]);

  const handleAdd = (product: Product, quantity: number = 1) => {
    addProduct(product, quantity);
    setDesktopCartOpen(true);
    toast.show({
      message: `${product.name} agregado a tu selección`,
      type: 'success',
      action: {
        label: 'Deshacer',
        onPress: () => {
          removeProduct(product.id);
          toast.show({ message: 'Producto quitado', type: 'info' });
        },
      },
    });
  };

  return (
    <View style={styles.container}>
      <ProductQuickView
        product={quickViewProduct}
        visible={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
        onAdd={handleAdd}
      />
      <MobileFilterSheet
        visible={filtersOpen}
        categories={CATEGORY_OPTIONS}
        selectedCategory={category}
        selectedAvailability={availability}
        categoryCounts={categoryCounts}
        getResultCount={countForFilters}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextCategory, nextAvailability) => {
          setCategory(nextCategory);
          setAvailability(nextAvailability);
          setFiltersOpen(false);
        }}
      />

      {isDesktop ? (
        <View style={styles.desktopRow}>
          {/* SIDEBAR DE FILTROS DESKTOP */}
          <View style={styles.desktopSidebar}>
            <Text style={styles.filterEyebrow}>COLECCIÓN</Text>
            <Text style={styles.desktopSidebarTitle}>Explorar colección</Text>

            <View style={styles.filterBlock}>
              <Text style={styles.filterBlockTitle}>Categorías</Text>
              {CATEGORY_OPTIONS.map((c) => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.filterRow, category === c && styles.filterRowActive]}>
                  <View style={[styles.checkbox, category === c && styles.checkboxActive]}>
                    {category === c && <View style={styles.checkboxDot} />}
                  </View>
                  <Text style={[styles.filterLabel, category === c && styles.filterLabelActive]}>{c}</Text>
                  <AnimatedNumber value={String(c === 'Todas' ? MOCK_PRODUCTS.length : c === 'Favoritos' ? favorites.length : MOCK_PRODUCTS.filter((p) => p.category === c).length)} style={styles.filterCount} />
                </Pressable>
              ))}
            </View>
            <View style={styles.filterNote}>
              <Feather name="help-circle" size={15} color={theme.colors.champagneAccessible} />
              <Text style={styles.filterNoteText}>¿Dudas sobre materiales o medidas? Te orientamos por WhatsApp.</Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 40, paddingTop: 32, paddingBottom: 60 }}
          >
            <View style={styles.catalogHeading}>
              <View>
                <Text style={styles.catalogEyebrow}>DESTELLOS DE HADA</Text>
                <Text style={styles.catalogTitle}>{category === 'Todas' ? 'Toda la colección' : category}</Text>
                <Text style={styles.catalogLead}>Joyas, aromas y prendas seleccionadas para acompañar tus momentos cotidianos.</Text>
              </View>
            </View>
            <View style={styles.desktopControlsRow}>
              <View style={{ flex: 1, maxWidth: 430 }}>
                <SearchBar value={query} onChangeText={setQuery} />
              </View>
              <View style={styles.resultsMeta}><View style={styles.resultsDot} /><Text style={styles.resultsCount}>{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}</Text></View>
            </View>

            <View style={{ height: 24 }} />

            {filtered.length === 0 ? (
              <EmptyState
                icon="search"
                title="No encontramos ese producto"
                description={`No existen resultados para "${query}".`}
                actionLabel="Ver toda la colección"
                onAction={() => {
                  setQuery('');
                  setCategory('Todas');
                }}
              />
            ) : (
              <ProductGrid
                products={filtered}
                onAdd={(p) => handleAdd(p, 1)}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            )}
          </ScrollView>

          {desktopCartOpen ? (
            <CartPanel variant="sidebar" onClose={() => setDesktopCartOpen(false)} />
          ) : (
            <Pressable
              onPress={() => setDesktopCartOpen(true)}
              style={({ hovered }) => [
                styles.desktopOpenCartTab,
                { backgroundColor: hovered ? theme.colors.primaryLight : theme.colors.primary },
              ]}
              accessibilityRole="button"
            >
              <Feather name="chevron-left" size={16} color="#FFFFFF" />
              <Feather name="shopping-bag" size={15} color="#FFFFFF" style={{ marginLeft: 4 }} />
              {lines.length > 0 && (
                <View style={styles.tabBadge}>
                  <AnimatedNumber value={String(lines.length)} style={[styles.tabBadgeText, { color: theme.colors.primary }]} />
                </View>
              )}
            </Pressable>
          )}
        </View>
      ) : (
        /* VISTA MOBILE */
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
            stickyHeaderIndices={[1]}
          >
            <View style={styles.mobileCatalogHeader}>
              <Text style={styles.catalogEyebrow}>COLECCIÓN</Text>
              <Text style={styles.mobileCatalogTitle}>{category === 'Todas' ? 'Encuentra tu próximo favorito' : category}</Text>
            </View>
            <View style={[styles.mobileStickyControls, { backgroundColor: theme.colors.background }]}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                large
                onFilterPress={() => setFiltersOpen(true)}
                activeFilterCount={(category === 'Todas' ? 0 : 1) + (availability === 'Todas' ? 0 : 1)}
              />
              <View style={{ height: 8 }} />
              <FilterChips options={CATEGORY_OPTIONS} selected={category} onSelect={setCategory} />
              <View style={styles.mobileResultsMeta}>
                <AnimatedNumber value={String(filtered.length)} style={[styles.mobileResultsCount, { color: theme.colors.primary }]} />
                <Text style={[styles.mobileResultsLabel, { color: theme.colors.textSecondary }]}>{filtered.length === 1 ? 'producto disponible' : 'productos disponibles'}</Text>
              </View>
            </View>

            {filtered.length === 0 ? (
              <EmptyState
                icon="search"
                title="No encontramos ese producto"
                description={`No existen resultados para "${query}".`}
                actionLabel="Ver catálogo"
                onAction={() => {
                  setQuery('');
                  setCategory('Todas');
                  setAvailability('Todas');
                }}
              />
            ) : (
              <ProductGrid
                products={filtered}
                onAdd={(p) => handleAdd(p, 1)}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            )}
          </ScrollView>

          <CartFloatingBar onOpen={() => bottomSheetRef.current?.expand()} />
          <CartBottomSheet ref={bottomSheetRef} onClose={() => bottomSheetRef.current?.close()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF5EB' },
  desktopRow: { flex: 1, flexDirection: 'row', position: 'relative' },
  desktopSidebar: {
    width: 250,
    paddingTop: 40,
    paddingLeft: 28,
    paddingRight: 24,
    borderRightWidth: 1,
    borderRightColor: 'rgba(84, 24, 43, 0.1)',
  },
  desktopSidebarTitle: {
    fontFamily: 'Georgia',
    fontSize: 23,
    lineHeight: 29,
    color: '#21191C',
    marginBottom: 30,
  },
  filterEyebrow: { color: '#6F2138', fontSize: 9.5, fontWeight: '800', letterSpacing: 2, marginBottom: 7 },
  filterBlock: {
    marginBottom: 24,
  },
  filterBlockTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#65575B',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 9,
    borderRadius: 7,
  },
  filterRowActive: { backgroundColor: '#F0E5E7' },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: 'rgba(84, 24, 43, 0.3)',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#54182B',
  },
  checkboxDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#54182B' },
  filterLabel: {
    fontSize: 13,
    color: '#54182B',
    flex: 1,
  },
  filterLabelActive: { fontWeight: '700' },
  filterCount: { fontSize: 10.5, color: '#8A7C80' },
  filterNote: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(84,24,43,0.1)', flexDirection: 'row', gap: 9 },
  filterNoteText: { flex: 1, color: '#65575B', fontSize: 10.5, lineHeight: 16 },
  catalogHeading: { marginBottom: 26 },
  catalogEyebrow: { color: '#6F2138', fontSize: 9.5, fontWeight: '800', letterSpacing: 2.2, marginBottom: 7 },
  catalogTitle: { fontFamily: 'Cormorant Garamond', fontSize: 39, lineHeight: 41, color: '#21191C', letterSpacing: -0.4, fontWeight: '600' },
  catalogLead: { color: '#65575B', fontSize: 13, marginTop: 7 },
  mobileCatalogHeader: { marginBottom: 18 },
  mobileCatalogTitle: { fontFamily: 'Cormorant Garamond', fontSize: 32, lineHeight: 34, color: '#21191C', fontWeight: '600' },
  mobileStickyControls: { marginHorizontal: -4, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 12, zIndex: 20 },
  mobileResultsMeta: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 5 },
  mobileResultsCount: { fontSize: 11, fontWeight: '800' },
  mobileResultsLabel: { fontSize: 10.5 },
  desktopControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsCount: {
    fontSize: 12.5,
    color: '#65575B',
  },
  resultsMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultsDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D7B56D' },
  desktopOpenCartTab: {
    position: 'absolute',
    right: 0,
    top: '35%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    zIndex: 20,
    cursor: 'pointer',
    boxShadow: '0px 4px 14px rgba(84, 24, 43, 0.25)',
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
