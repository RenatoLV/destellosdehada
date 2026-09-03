/**
 * components/ui/Button.tsx
 * Sección 31/48: variantes primary/secondary/ghost/danger/success, estados
 * default/pressed/loading/disabled. Construido sobre AnimatedPressable — evita
 * que cada pantalla defina su propio <Pressable> con estilos repetidos.
 */
import { ActivityIndicator, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import type { HapticKind } from '@/hooks/useHaptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  haptic?: HapticKind | 'none';
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  haptic = 'light',
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.colors.primary, fg: '#FFFFFF' },
    secondary: { bg: theme.colors.lavender, fg: theme.colors.primary },
    ghost: { bg: 'transparent', fg: theme.colors.primary, border: theme.colors.border },
    danger: { bg: theme.colors.error, fg: '#FFFFFF' },
    success: { bg: theme.colors.success, fg: '#FFFFFF' },
  };
  const { bg, fg, border } = palette[variant];

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        height: size === 'lg' ? 52 : theme.touchTarget.min,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.md,
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: border,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Text style={[theme.typography.bodyMedium, { color: fg }]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}
