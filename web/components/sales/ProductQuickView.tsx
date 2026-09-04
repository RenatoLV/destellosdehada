import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { Product } from '@/services/catalog';
import { formatCLP } from '@/utils/formatCurrency';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useToast } from '@/components/ui/Toast';
import { useWebModalFocusTrap } from '@/hooks/useWebModalFocusTrap';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onAdd: (product: Product, quantity: number) => void;
};

export function ProductQuickView({ product, visible, onClose, onAdd }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const deviceClass = useDeviceClass();
  const isDesktop = deviceClass === 'desktop';
  const reducedMotion = useReducedMotion();
  const [quantity, setQuantity] = useState(1);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.97);
  const translateY = useSharedValue(0);
  useWebModalFocusTrap(visible, 'product-quick-view');

  useEffect(() => {
    if (!visible) return;
    setQuantity(1);
    translateY.value = 0;
    if (reducedMotion) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withTiming(1, { duration: 220 });
  }, [visible]);

  const closeWithAnimation = () => {
    if (reducedMotion) {
      onClose();
      return;
    }
    opacity.value = withTiming(0, { duration: 180 });
    if (isDesktop) {
      scale.value = withTiming(0.97, { duration: 180 }, () => runOnJS(onClose)());
    } else {
      translateY.value = withTiming(700, { duration: 220 }, () => runOnJS(onClose)());
    }
  };

  const panGesture = Gesture.Pan()
    .enabled(!isDesktop)
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
      opacity.value = Math.max(0.45, 1 - event.translationY / 500);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 750) {
        opacity.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(700, { duration: 220 }, () => runOnJS(onClose)());
      } else {
        opacity.value = withTiming(1, { duration: 150 });
        translateY.value = withSpring(0, theme.spring.snappy);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!product) return null;
  const isSoldOut = product.availability === 'agotado';
  const assurances = product.category === 'Perfumes'
    ? ['Aroma seleccionado y presentación cuidada', 'Empaque protegido y listo para regalar']
    : product.category === 'Ropa'
      ? ['Textiles suaves y terminaciones cuidadas', 'Te ayudamos con el calce por WhatsApp']
      : ['Material seleccionado y terminación cuidada', 'Empaque listo para regalar'];

  const handleAdd = () => {
    if (isSoldOut) return;
    onAdd(product, quantity);
    closeWithAnimation();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeWithAnimation}
      accessibilityViewIsModal
    >
      <Pressable style={[styles.backdrop, !isDesktop && styles.backdropMobile]} onPress={closeWithAnimation}>
        <Animated.View
          testID="product-quick-view"
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: isDesktop ? 18 : 22,
              maxWidth: isDesktop ? 850 : '100%',
              ...theme.shadows.dialog,
            },
            !isDesktop && styles.cardMobile,
            animatedCardStyle,
          ]}
          onStartShouldSetResponder={() => true}
        >
          {!isDesktop && (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={styles.dragHandleArea} accessibilityLabel="Desliza hacia abajo para cerrar">
                <View style={[styles.dragHandle, { backgroundColor: theme.colors.borderStrong }]} />
              </Animated.View>
            </GestureDetector>
          )}

          <View style={[styles.closeBtn, !isDesktop && styles.closeBtnMobile]}>
            <IconButton icon="x" size={18} onPress={closeWithAnimation} accessibilityLabel="Cerrar detalle" />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[styles.body, !isDesktop && styles.bodyMobile]}
          >
            <View style={[styles.imageWrap, !isDesktop && styles.imageWrapMobile]}>
              <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" />
            </View>

            <View style={[styles.details, !isDesktop && styles.detailsMobile]}>
              <View style={styles.headerRow}>
                <Text style={[styles.categoryLabel, { color: theme.colors.primary }]}>{product.category}</Text>
                <View style={[styles.stockPill, { backgroundColor: isSoldOut ? theme.colors.surfaceSubdued : theme.colors.successLight }]}>
                  <Text style={[styles.stockPillText, { color: isSoldOut ? theme.colors.textMuted : theme.colors.success }]}>
                    {isSoldOut ? 'Agotado' : 'Disponible'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.titleText, { color: theme.colors.text }]}>{product.name}</Text>
              <Text style={[styles.materialText, { color: theme.colors.textSecondary }]}>{product.material}</Text>
              <Text style={[styles.priceText, { color: theme.colors.primary }]}>{formatCLP(product.price * quantity)}</Text>

              {product.description && (
                <Text style={[styles.descriptionText, { color: theme.colors.textSecondary }]}>{product.description}</Text>
              )}

              <View style={[styles.assuranceList, { borderColor: theme.colors.border }]}>
                <View style={styles.assuranceItem}><Text style={[styles.assuranceMark, { color: theme.colors.primary }]}>01</Text><Text style={[styles.assuranceText, { color: theme.colors.textSecondary }]}>{assurances[0]}</Text></View>
                <View style={styles.assuranceItem}><Text style={[styles.assuranceMark, { color: theme.colors.primary }]}>02</Text><Text style={[styles.assuranceText, { color: theme.colors.textSecondary }]}>{assurances[1]}</Text></View>
              </View>

              {!isSoldOut ? (
                <View style={styles.actionSection}>
                  <View style={[styles.stepper, { borderColor: theme.colors.border }]}>
                    <IconButton icon="minus" size={15} disabled={quantity <= 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} accessibilityLabel="Disminuir cantidad" backgroundColor={theme.colors.ivory} />
                    <AnimatedNumber value={String(quantity)} style={[styles.quantityNum, { color: theme.colors.text }]} />
                    <IconButton icon="plus" size={15} disabled={quantity >= product.stock} onPress={() => setQuantity((value) => Math.min(product.stock, value + 1))} accessibilityLabel="Aumentar cantidad" backgroundColor={theme.colors.ivory} />
                  </View>
                  <View style={styles.addWrap}>
                    <Button label="Agregar al carrito" variant="primary" size="md" icon="shopping-bag" onPress={handleAdd} />
                  </View>
                </View>
              ) : (
                <Button
                  label="Avisarme cuando vuelva"
                  icon="bell"
                  variant="secondary"
                  size="md"
                  onPress={() => {
                    toast.show({ message: `Te avisaremos cuando vuelva ${product.name}.`, type: 'info' });
                    closeWithAnimation();
                  }}
                />
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,12,22,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  backdropMobile: { justifyContent: 'flex-end', padding: 0 },
  card: { width: '100%', maxHeight: '92%', position: 'relative', overflow: 'hidden', borderWidth: 1 },
  cardMobile: { maxHeight: '94%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dragHandleArea: { height: 42, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 46, height: 4, borderRadius: 2 },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 10 },
  closeBtnMobile: { top: 7 },
  body: { flexDirection: 'row', gap: 34, padding: 12 },
  bodyMobile: { flexDirection: 'column', gap: 0, paddingTop: 0 },
  imageWrap: { width: 400, minHeight: 510, borderRadius: 13, overflow: 'hidden', backgroundColor: '#EEE4D8' },
  imageWrapMobile: { width: '100%', height: 270, minHeight: 270, borderRadius: 12 },
  image: { width: '100%', height: '100%' },
  details: { flex: 1, justifyContent: 'center', paddingVertical: 30, paddingRight: 28 },
  detailsMobile: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 },
  categoryLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  stockPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  stockPillText: { fontSize: 10.5, fontWeight: '700' },
  titleText: { fontFamily: 'Cormorant Garamond', fontSize: 34, lineHeight: 36, marginTop: 13, fontWeight: '600' },
  materialText: { fontSize: 12.5, marginTop: 5 },
  priceText: { fontSize: 20, fontWeight: '700', marginTop: 15, marginBottom: 13 },
  descriptionText: { fontSize: 13, lineHeight: 20, marginBottom: 17 },
  assuranceList: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 11, marginBottom: 18, gap: 8 },
  assuranceItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assuranceMark: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  assuranceText: { fontSize: 11.5, flex: 1 },
  actionSection: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 3 },
  quantityNum: { fontSize: 14, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  addWrap: { flex: 1, marginLeft: 12 },
});
