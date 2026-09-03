/**
 * components/sales/FilterChips.tsx
 * Sección 18: descubrimiento de productos, no administración. Horizontal en
 * mobile y desktop.
 */
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

type Props = {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
};

export function FilterChips({ options, selected, onSelect }: Props) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <AnimatedPressable
            key={option}
            onPress={() => onSelect(option)}
            haptic="light"
            scale={0.96}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Filtrar por ${option}`}
            style={{
              paddingHorizontal: theme.spacing.md,
              height: 44,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: theme.spacing.xs,
              backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
              borderWidth: isActive ? 0 : 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text style={[theme.typography.label, { color: isActive ? '#FFFFFF' : theme.colors.text }]}>
              {option}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 4 },
});
