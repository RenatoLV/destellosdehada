/**
 * components/ui/AnimatedNumber.tsx
 * Secciones 10/31/32: cuando el total o el contador del carrito cambian, un
 * pequeño scale-pulse en UI thread — nunca un cambio instantáneo, pero
 * tampoco algo que comprometa la legibilidad del precio mientras ocurre
 * (por eso solo se anima la escala, no los dígitos carácter por carácter).
 */
import { useEffect, useRef } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  /** Valor ya formateado (ej. formatCLP(total)) — este componente no formatea moneda. */
  value: string;
  style?: StyleProp<TextStyle>;
};

const AnimatedText = Animated.createAnimatedComponent(Text);

export function AnimatedNumber({ value, style }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current !== value) {
      previousValue.current = value;
      if (!reducedMotion) {
        scale.value = withSequence(
          withTiming(1.08, { duration: theme.duration.fast / 2 }),
          withTiming(1, { duration: theme.duration.fast })
        );
      }
    }
  }, [value, reducedMotion, scale, theme.duration.fast]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <AnimatedText style={[style, animatedStyle]}>{value}</AnimatedText>;
}
