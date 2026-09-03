/**
 * components/sales/SearchBar.tsx
 * Fase 3.5 — sección 16/17: ícono real (Feather, no emoji), botón clear,
 * y debounce interno (~250ms, sección 11): el input se siente instantáneo
 * al tipear, pero `onChangeText` (que dispara el filtro real) llega debounced.
 * Enter dispara el filtro inmediatamente sin esperar el debounce.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { IconButton } from '@/components/ui/IconButton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  large?: boolean;
  onFilterPress?: () => void;
  activeFilterCount?: number;
};

export function SearchBar({ value, onChangeText, large = false, onFilterPress, activeFilterCount = 0 }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  const debouncedDraft = useDebouncedValue(draft, 250);

  // Propaga el valor debounced hacia arriba.
  useEffect(() => {
    onChangeText(debouncedDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radius.md,
          height: large ? 52 : 44,
          paddingLeft: theme.spacing.md,
          paddingRight: theme.spacing.xxs,
        },
      ]}
    >
      <Feather name="search" size={large ? 18 : 16} color={theme.colors.primary} />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Buscar producto, material o código"
        placeholderTextColor={theme.colors.textSecondary}
        style={[theme.typography.body, { flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.text }]}
        accessibilityLabel="Buscar producto por nombre, SKU o material"
        returnKeyType="search"
        onSubmitEditing={() => onChangeText(draft)}
      />
      {draft.length > 0 && (
        <IconButton icon="x" size={14} onPress={() => setDraft('')} accessibilityLabel="Limpiar búsqueda" haptic="none" />
      )}
      {onFilterPress && (
        <Pressable
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel={activeFilterCount > 0 ? `Abrir filtros, ${activeFilterCount} activos` : 'Abrir filtros'}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.ivory,
              borderColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.border,
              opacity: pressed ? 0.76 : 1,
            },
          ]}
        >
          <Feather name="sliders" size={16} color={activeFilterCount > 0 ? '#FFFFFF' : theme.colors.primary} />
          {activeFilterCount > 0 && <Text style={styles.filterCount}>{activeFilterCount}</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  filterButton: {
    minWidth: 42,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
  },
  filterCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
