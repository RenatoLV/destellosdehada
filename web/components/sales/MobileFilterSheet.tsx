import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { useWebModalFocusTrap } from '@/hooks/useWebModalFocusTrap';

export type AvailabilityFilter = 'Todas' | 'Disponibles' | 'Últimas unidades' | 'Agotados';

type Props = {
  visible: boolean;
  categories: string[];
  selectedCategory: string;
  selectedAvailability: AvailabilityFilter;
  categoryCounts: Record<string, number>;
  getResultCount: (category: string, availability: AvailabilityFilter) => number;
  onClose: () => void;
  onApply: (category: string, availability: AvailabilityFilter) => void;
};

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; detail: string }[] = [
  { value: 'Todas', detail: 'Sin limitar por stock' },
  { value: 'Disponibles', detail: 'Listos para comprar' },
  { value: 'Últimas unidades', detail: 'Quedan pocas unidades' },
  { value: 'Agotados', detail: 'Productos sin stock' },
];

export function MobileFilterSheet({
  visible,
  categories,
  selectedCategory,
  selectedAvailability,
  categoryCounts,
  getResultCount,
  onClose,
  onApply,
}: Props) {
  const theme = useTheme();
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [draftAvailability, setDraftAvailability] = useState<AvailabilityFilter>(selectedAvailability);
  useWebModalFocusTrap(visible, 'mobile-filter-sheet');

  useEffect(() => {
    if (!visible) return;
    setDraftCategory(selectedCategory);
    setDraftAvailability(selectedAvailability);
  }, [visible, selectedCategory, selectedAvailability]);

  const clear = () => {
    setDraftCategory('Todas');
    setDraftAvailability('Todas');
  };
  const resultCount = getResultCount(draftCategory, draftAvailability);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          testID="mobile-filter-sheet"
          style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>AFINA TU BÚSQUEDA</Text>
              <Text style={[styles.title, { color: theme.colors.text }]}>¿Qué estás buscando?</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Elige una categoría y el estado del stock.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar filtros" style={[styles.close, { backgroundColor: theme.colors.ivory }]}>
              <Feather name="x" size={19} color={theme.colors.primary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Categoría</Text>
            <View style={styles.categoryGrid}>
              {categories.map((option) => {
                const selected = draftCategory === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setDraftCategory(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={({ pressed }) => [
                      styles.categoryOption,
                      {
                        backgroundColor: selected ? theme.colors.primary : theme.colors.ivory,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryName, { color: selected ? '#FFFFFF' : theme.colors.text }]}>{option}</Text>
                    <Text style={[styles.categoryCount, { color: selected ? '#F3DBE2' : theme.colors.textSecondary }]}>{categoryCounts[option] ?? 0}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, styles.stockLabel, { color: theme.colors.text }]}>Disponibilidad</Text>
            <View style={[styles.stockList, { borderColor: theme.colors.border }]}>
              {AVAILABILITY_OPTIONS.map((option, index) => {
                const selected = draftAvailability === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setDraftAvailability(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={({ pressed }) => [
                      styles.stockRow,
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border },
                      { opacity: pressed ? 0.72 : 1 },
                    ]}
                  >
                    <View style={[styles.radio, { borderColor: selected ? theme.colors.primary : theme.colors.borderStrong }]}>
                      {selected && <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stockTitle, { color: theme.colors.text }]}>{option.value}</Text>
                      <Text style={[styles.stockDetail, { color: theme.colors.textSecondary }]}>{option.detail}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Button label="Limpiar" variant="secondary" size="md" onPress={clear} />
            <View style={{ flex: 1 }}>
              <Button
                label={`Ver ${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}`}
                variant="primary"
                size="md"
                onPress={() => onApply(draftCategory, draftAvailability)}
              />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(25, 13, 17, 0.48)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '91%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D8C9C4', alignSelf: 'center', marginTop: 10 },
  header: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 15, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  eyebrow: { fontSize: 9, lineHeight: 12, letterSpacing: 1.8, fontWeight: '800', marginBottom: 5 },
  title: { fontFamily: 'Cormorant Garamond', fontSize: 28, lineHeight: 31, fontWeight: '600' },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 18 },
  sectionLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700', marginBottom: 11 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: { minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryName: { fontSize: 12.5, fontWeight: '600' },
  categoryCount: { fontSize: 10.5, fontWeight: '700' },
  stockLabel: { marginTop: 24 },
  stockList: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  stockRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  stockTitle: { fontSize: 12.5, fontWeight: '700' },
  stockDetail: { fontSize: 10.5, marginTop: 2 },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
