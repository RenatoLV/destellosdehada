/**
 * components/sales/CartItemRow.tsx
 * Fase 3.5 — sección 11/33: imagen del producto, controles táctiles 44x44
 * vía IconButton, y salida animada (Layout Animations) al eliminar en vez de
 * desaparecer instantáneo (sección 12/34).
 */
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeOutLeft, Layout } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/theme';
import type { CartLine } from '@/context/CartContext';
import { formatCLP } from '@/utils/formatCurrency';
import { IconButton } from '@/components/ui/IconButton';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useHaptics } from '@/hooks/useHaptics';

type Props = {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export function CartItemRow({ line, onIncrement, onDecrement, onRemove }: Props) {
  const theme = useTheme();
  const triggerHaptic = useHaptics();
  const { product, quantity } = line;
  const lineTotal = formatCLP(product.price * quantity);

  const renderRightActions = () => {
    return (
      <Pressable
        style={styles.deleteAction}
        onPress={() => {
          triggerHaptic('medium');
          onRemove();
        }}
      >
        <Feather name="trash-2" size={20} color="#FFFFFF" />
      </Pressable>
    );
  };

  return (
    <Animated.View
      layout={Layout.duration(theme.duration.fast)}
      exiting={FadeOutLeft.duration(theme.duration.fast)}
      style={{ marginBottom: 1 }}
    >
      <Swipeable
        renderRightActions={renderRightActions}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        containerStyle={{ overflow: 'visible' }}
      >
        <View style={[styles.row, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={[styles.thumb, { backgroundColor: theme.colors.lavender, borderRadius: 10 }]}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.thumbImage} contentFit="cover" transition={150} />
            ) : (
              <Feather name="award" size={18} color={theme.colors.champagne} />
            )}
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
              {product.material}
            </Text>
            <AnimatedNumber
              value={lineTotal}
              style={[theme.typography.bodyMedium, { color: theme.colors.primary, fontWeight: '700', marginTop: 2 }]}
            />
          </View>

          <View style={styles.stepper}>
            <IconButton
              icon="minus"
              size={13}
              onPress={onDecrement}
              accessibilityLabel={`Quitar una unidad de ${product.name}`}
              backgroundColor={theme.colors.lavender}
            />
            <Text
              style={[
                theme.typography.bodyMedium,
                { color: theme.colors.text, minWidth: 22, textAlign: 'center', fontWeight: '700' },
              ]}
            >
              {quantity}
            </Text>
            <IconButton
              icon="plus"
              size={13}
              onPress={onIncrement}
              accessibilityLabel={`Agregar una unidad de ${product.name}`}
              backgroundColor={theme.colors.lavender}
            />
          </View>

          {/* Fallback button in case they don't want to swipe */}
          <IconButton
            icon="trash-2"
            size={15}
            color={theme.colors.error}
            onPress={() => {
              triggerHaptic('light');
              onRemove();
            }}
            accessibilityLabel={`Quitar ${product.name} de la selección`}
            haptic="none"
          />
        </View>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, paddingHorizontal: 4 },
  thumb: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  stepper: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  deleteAction: {
    backgroundColor: '#BE123C',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
});
