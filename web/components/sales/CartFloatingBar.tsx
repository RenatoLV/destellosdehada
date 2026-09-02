/**
 * components/sales/CartFloatingBar.tsx
 * Floating Cart Bar para mobile con Reanimated spring y AnimatedNumber pulse.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useCart } from '@/context/CartContext';
import { formatCLP } from '@/utils/formatCurrency';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  onOpen: () => void;
};

export function CartFloatingBar({ onOpen }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const { itemCount, total } = useCart();
  const visible = itemCount > 0;

  const translateY = useSharedValue(100);
  const countScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, theme.spring.snappy);
    } else {
      translateY.value = withTiming(100, { duration: theme.duration.fast });
    }
  }, [visible]);

  useEffect(() => {
    if (!reducedMotion && itemCount > 0) {
      countScale.value = withSequence(
        withSpring(1.18, theme.spring.bouncy),
        withSpring(1, theme.spring.snappy)
      );
    }
  }, [itemCount, reducedMotion]);

  const barAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const countAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.dock,
        {
          backgroundColor: theme.colors.text,
          borderRadius: theme.radius.full,
          ...theme.shadows.dialog,
          zIndex: theme.zIndex.dock,
        },
        barAnimatedStyle,
      ]}
    >
      <View style={styles.info}>
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: theme.colors.primary, borderRadius: theme.radius.full },
            countAnimatedStyle,
          ]}
        >
          <Text style={[theme.typography.label, { color: '#FFFFFF', fontSize: 13 }]}>{itemCount}</Text>
        </Animated.View>

        <View style={{ marginLeft: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.champagneLight }]}>
            {itemCount === 1 ? '1 producto' : `${itemCount} productos`}
          </Text>
          <AnimatedNumber
            value={formatCLP(total)}
            style={[theme.typography.bodyMedium, { color: '#FFFFFF', fontWeight: '700' }]}
          />
        </View>
      </View>

      <AnimatedPressable
        onPress={onOpen}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Abrir detalle de venta"
        style={[
          styles.actionButton,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.full,
          },
        ]}
      >
        <Text style={[theme.typography.bodyMedium, { color: '#FFFFFF', marginRight: 6 }]}>Ver carrito</Text>
        <Feather name="arrow-right" size={16} color="#FFFFFF" />
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 8,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
  },
});
