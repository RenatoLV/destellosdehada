/**
 * components/ui/IconButton.tsx
 * Sección 7/32/49: reemplaza ✕, ♥/♡, ✨, 🔍, −, + como iconografía funcional.
 * Touch target mínimo 44x44 (sección 12), construido sobre AnimatedPressable.
 */
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import type { HapticKind } from '@/hooks/useHaptics';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  haptic?: HapticKind | 'none';
  disabled?: boolean;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 18,
  color,
  backgroundColor,
  haptic = 'light',
  disabled,
}: Props) {
  const theme = useTheme();

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: theme.touchTarget.min,
        height: theme.touchTarget.min,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: backgroundColor ?? 'transparent',
      }}
    >
      <Feather name={icon} size={size} color={color ?? theme.colors.text} />
    </AnimatedPressable>
  );
}
