import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';

const ITEMS = [
  { icon: 'truck' as const, label: 'Despachos a todo Chile' },
  { icon: 'heart' as const, label: 'Joyas, perfumes y moda' },
  { icon: 'message-circle' as const, label: 'Atención personalizada' },
];

export function AnnouncementBar() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const visibleItems = width < 640 ? ITEMS.slice(0, 1) : ITEMS;

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.primaryDark }]} accessibilityRole="summary">
      {visibleItems.map((item, index) => (
        <View key={item.label} style={styles.item}>
          {index > 0 && <View style={styles.divider} />}
          <Feather name={item.icon} size={12} color={theme.colors.champagneLight} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  divider: { width: 1, height: 11, backgroundColor: 'rgba(255,255,255,0.18)', marginRight: 11 },
  label: { color: 'rgba(255,255,255,0.84)', fontSize: 10.5, fontWeight: '600', letterSpacing: 0.25 },
});
