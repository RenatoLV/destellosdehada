/**
 * components/ui/EmptyState.tsx
 * Estado vacío reutilizable y elegante con iconografía Feather y Design Tokens.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';

type Props = {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'star', title, description, actionLabel, onAction }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.xl }]}>
      <View style={styles.brandLine}>
        <View style={[styles.line, { backgroundColor: theme.colors.champagne }]} />
        <Text style={[styles.brandLabel, { color: theme.colors.primary }]}>DESTELLOS DE HADA</Text>
        <View style={[styles.line, { backgroundColor: theme.colors.champagne }]} />
      </View>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.colors.ivory, borderColor: theme.colors.champagneLight, borderRadius: theme.radius.full },
        ]}
      >
        <Feather name={icon} size={28} color={theme.colors.primary} />
      </View>
      <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, marginTop: theme.spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      {description && (
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.textSecondary,
              marginTop: theme.spacing.xs,
              textAlign: 'center',
              maxWidth: 320,
            },
          ]}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderWidth: 1,
  },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  line: { width: 22, height: 1 },
  brandLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1.8 },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
