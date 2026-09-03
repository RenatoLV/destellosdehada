/**
 * components/ui/Badge.tsx
 * Sección 33/50: reemplaza el badge inline de ProductCard. Nunca depende
 * solo del color — siempre lleva texto (y opcionalmente ícono).
 */
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

type Props = {
  children: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ children, variant = 'neutral', style }: Props) {
  const theme = useTheme();

  const colorMap: Record<BadgeVariant, { bg: string; fg: string }> = {
    success: { bg: theme.colors.success, fg: '#FFFFFF' },
    warning: { bg: theme.colors.warning, fg: '#FFFFFF' },
    error: { bg: theme.colors.error, fg: '#FFFFFF' },
    info: { bg: theme.colors.primary, fg: '#FFFFFF' },
    neutral: { bg: theme.colors.textSecondary, fg: '#FFFFFF' },
  };
  const { bg, fg } = colorMap[variant];

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: 3,
          alignSelf: 'flex-start',
        },
        style,
      ]}
      accessibilityRole="text"
    >
      <Text style={[theme.typography.caption, { color: fg }]}>{children}</Text>
    </View>
  );
}
