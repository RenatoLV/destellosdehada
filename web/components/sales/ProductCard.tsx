import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import type { Product } from '@/services/catalog';
import { formatCLP } from '@/utils/formatCurrency';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductPlaceholder } from '@/components/sales/ProductPlaceholder';
import { useHaptics } from '@/hooks/useHaptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuth } from '@/context/AuthContext';

type Props = {
  product: Product;
  onAdd: (product: Product) => void;
  onQuickView?: (product: Product) => void;
  index?: number;
};

export function ProductCard({ product, onAdd, onQuickView, index = 0 }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const triggerHaptic = useHaptics();
  const { isFavorite, toggleFavorite } = useAuth();
  const favorite = isFavorite(product.id);
  const [hovered, setHovered] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const favoriteScale = useSharedValue(1);
  const isSoldOut = product.availability === 'agotado';
  const isLowStock = product.availability === 'ultimas_unidades';

  const favoriteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favoriteScale.value }],
  }));

  const handleFavorite = () => {
    toggleFavorite(product.id);
    triggerHaptic('light');
    if (!reducedMotion) {
      favoriteScale.value = withSpring(1.18, theme.spring.bouncy, () => {
        favoriteScale.value = withSpring(1, theme.spring.bouncy);
      });
    }
  };

  const handleAdd = () => {
    if (!isSoldOut) onAdd(product);
  };

  const badge = isSoldOut
    ? { label: 'Agotado', color: theme.colors.soldOut }
    : product.compareAtPrice
      ? { label: 'Oferta', color: theme.colors.offer }
      : isLowStock
        ? { label: 'Últimas', color: theme.colors.lowStock }
        : product.featured
          ? { label: 'Nuevo', color: theme.colors.new }
          : null;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 45).duration(360)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: hovered ? theme.colors.borderStrong : theme.colors.border,
          ...theme.shadows[hovered ? 'cardHover' : 'card'],
        },
      ]}
    >
      <Pressable
        onPress={() => onQuickView?.(product)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={styles.imageWrap}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle de ${product.name}`}
      >
        {!imageFailed && <Image
          source={{ uri: product.imageUrl }}
          style={[styles.image, hovered && styles.imageHovered]}
          contentFit="cover"
          transition={180}
          onLoadStart={() => {
            setImageFailed(false);
            setImageLoading(true);
          }}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageFailed(true);
          }}
        />}
        {imageFailed && <ProductPlaceholder category={product.category} sku={product.sku} />}
        {imageLoading && <Skeleton style={StyleSheet.absoluteFill} borderRadius={0} />}

        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        )}

        <AnimatedPressable
          onPress={handleFavorite}
          haptic="none"
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={favorite ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
          accessibilityState={{ selected: favorite }}
          style={[styles.favoriteBtn, favoriteAnimatedStyle]}
        >
          <Feather
            name="heart"
            size={18}
            color={favorite ? theme.colors.error : theme.colors.textSecondary}
          />
        </AnimatedPressable>

        {!isSoldOut && hovered && (
          <Pressable onPress={handleAdd} style={[styles.hoverAddBtn, { backgroundColor: theme.colors.primaryDark }]}>
            <Feather name="plus" size={15} color={theme.colors.textInverse} />
            <Text style={styles.hoverAddBtnText}>Agregar a la selección</Text>
          </Pressable>
        )}
      </Pressable>

      <Pressable onPress={() => onQuickView?.(product)} style={styles.infoSection}>
        <Text style={[styles.productName, { color: theme.colors.text }]} numberOfLines={2}>{product.name}</Text>
        <Text style={[styles.productMaterial, { color: theme.colors.textSecondary }]} numberOfLines={1}>{product.material}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.priceText, { color: theme.colors.primary }]}>{formatCLP(product.price)}</Text>
          {product.compareAtPrice && (
            <Text style={[styles.comparePriceText, { color: theme.colors.textMuted }]}>{formatCLP(product.compareAtPrice)}</Text>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={handleAdd}
        disabled={isSoldOut}
        style={({ hovered: buttonHovered, pressed }) => [
          styles.addButton,
          {
            backgroundColor: isSoldOut ? theme.colors.surfaceSubdued : theme.colors.ivory,
            borderColor: isSoldOut ? 'transparent' : theme.colors.borderStrong,
          },
          (buttonHovered || pressed) && !isSoldOut && { backgroundColor: theme.colors.lavender },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isSoldOut ? `${product.name} sin stock` : `Agregar ${product.name} al carrito`}
        accessibilityState={{ disabled: isSoldOut }}
      >
        <Feather name={isSoldOut ? 'x' : 'shopping-bag'} size={16} color={isSoldOut ? theme.colors.textMuted : theme.colors.primary} />
        <Text style={[styles.addButtonText, { color: isSoldOut ? theme.colors.textMuted : theme.colors.primary }]}>
          {isSoldOut ? 'Sin stock' : 'Agregar'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  imageWrap: { aspectRatio: 1, backgroundColor: '#EEE4D8', position: 'relative', overflow: 'hidden' },
  image: { width: '100%', height: '100%', transform: [{ scale: 1 }] },
  imageHovered: { transform: [{ scale: 1.025 }] },
  badge: { position: 'absolute', left: 9, top: 9, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, zIndex: 5 },
  badgeText: { fontSize: 9.5, color: '#FFFDF9', fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase' },
  favoriteBtn: { position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,252,247,0.95)', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  hoverAddBtn: { position: 'absolute', bottom: 9, left: 9, right: 9, borderRadius: 7, minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  hoverAddBtnText: { color: '#FFFDF9', fontSize: 12, fontWeight: '700' },
  infoSection: { paddingHorizontal: 13, paddingTop: 13 },
  productName: { fontFamily: 'Cormorant Garamond', fontSize: 19, lineHeight: 21, fontWeight: '600', minHeight: 42 },
  productMaterial: { fontSize: 10.5, marginTop: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  priceText: { fontSize: 13.5, fontWeight: '700' },
  comparePriceText: { fontSize: 10.5, textDecorationLine: 'line-through' },
  addButton: { margin: 13, minHeight: 44, borderRadius: 7, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addButtonText: { fontSize: 12.5, fontWeight: '700' },
});
