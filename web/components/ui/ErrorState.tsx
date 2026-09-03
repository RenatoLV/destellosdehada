/**
 * components/ui/ErrorState.tsx
 * Estado de error elegante con opción de reintentar.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'No pudimos cargar la información',
  description = 'Ocurrió un inconveniente temporal. Por favor, intenta de nuevo.',
  onRetry,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.colors.pink, borderRadius: theme.radius.full },
        ]}
      >
        <Feather name="alert-circle" size={28} color={theme.colors.error} />
      </View>
      <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, marginTop: theme.spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
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
      {onRetry && (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label="Intentar nuevamente" onPress={onRetry} variant="primary" icon="refresh-cw" />
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
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
