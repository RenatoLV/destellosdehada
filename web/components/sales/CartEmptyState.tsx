/**
 * components/sales/CartEmptyState.tsx
 * Estado vacío para el carrito con iconografía Feather y copy premium.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';

type Props = {
  onClose?: () => void;
};

export function CartEmptyState({ onClose }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.lavender, borderRadius: theme.radius.full },
        ]}
      >
        <Feather name="shopping-bag" size={32} color={theme.colors.primary} />
      </View>
      <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
        Tu selección está esperando
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textSecondary, marginTop: theme.spacing.xs, textAlign: 'center', maxWidth: 260 },
        ]}
      >
        Explora nuestra colección y añade tus productos favoritos.
      </Text>
      {onClose && (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label="Explorar colección" onPress={onClose} variant="primary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
});
