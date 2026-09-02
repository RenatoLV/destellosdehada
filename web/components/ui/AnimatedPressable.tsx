/**
 * components/ui/AnimatedPressable.tsx
 * Sección 4: base de interacción táctil para TODA la app. Antes, ProductCard
 * animaba con el `style` callback de Pressable (React puro, no Reanimated —
 * ver punto 1 de la evaluación). Este componente sí usa Reanimated real:
 * useSharedValue + useAnimatedStyle + withSpring corriendo en el UI thread.
 *
 * Todo elemento interactivo importante (Button, IconButton, ProductCard,
 * favorito, tabs, filtros) debería construirse sobre este componente para
 * compartir el mismo comportamiento de press/hover/haptic/reduced motion.
 */
import { forwardRef, useState, type ElementRef, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useHaptics, type HapticKind } from '@/hooks/useHaptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type InteractionState = { pressed: boolean; hovered: boolean };

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode | ((state: InteractionState) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: InteractionState) => StyleProp<ViewStyle>);
  /** Escala en press. Default: theme.interaction.pressScale (sección 21: 0.97). */
  scale?: number;
  /** Haptic semántico a disparar en onPress (sección 15). 'none' para omitirlo. */
  haptic?: HapticKind | 'none';
  disabled?: boolean;
};

export const AnimatedPressable = forwardRef<ElementRef<typeof Pressable>, Props>(function AnimatedPressable(
  { children, style, scale, haptic = 'none', onPressIn, onPressOut, onHoverIn, onHoverOut, onPress, disabled, ...rest },
  ref
) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const triggerHaptic = useHaptics();
  const pressProgress = useSharedValue(0);
  const [hovered, setHovered] = useState(false);
  const [pressedState, setPressedState] = useState(false);
  const targetScale = scale ?? theme.interaction.pressScale;

  const pressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : withSpring(pressProgress.value ? targetScale : 1, theme.spring.snappy) }],
  }));

  const disabledAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(disabled ? 0.5 : 1, { duration: theme.duration.fast }),
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    pressProgress.value = 1;
    setPressedState(true);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    pressProgress.value = 0;
    setPressedState(false);
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic !== 'none') triggerHaptic(haptic);
    onPress?.(e);
  };

  const state: InteractionState = { pressed: pressedState, hovered };
  const resolvedStyle = typeof style === 'function' ? style(state) : style;

  return (
    <AnimatedPressableBase
      ref={ref}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onHoverIn={(e: any) => {
        setHovered(true);
        onHoverIn?.(e);
      }}
      onHoverOut={(e: any) => {
        setHovered(false);
        onHoverOut?.(e);
      }}
      style={[resolvedStyle, pressAnimatedStyle, disabledAnimatedStyle]}
      {...rest}
    >
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressableBase>
  );
});
