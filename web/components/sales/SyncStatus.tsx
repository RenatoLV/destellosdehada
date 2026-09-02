/**
 * components/sales/SyncStatus.tsx
 * Indicador de sincronización con iconografía Feather y colores semánticos.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export type SyncState = 'synced' | 'pending' | 'syncing' | 'error';

type Props = {
  state?: SyncState;
  compact?: boolean;
};

const CONFIG: Record<
  SyncState,
  { icon: keyof typeof Feather.glyphMap; label: string; colorKey: 'success' | 'warning' | 'primary' | 'error' }
> = {
  synced: { icon: 'check-circle', label: 'Todo sincronizado', colorKey: 'success' },
  pending: { icon: 'clock', label: 'Pedidos pendientes', colorKey: 'warning' },
  syncing: { icon: 'refresh-cw', label: 'Sincronizando', colorKey: 'primary' },
  error: { icon: 'alert-triangle', label: 'Error de sincronización', colorKey: 'error' },
};

export function SyncStatus({ state = 'synced', compact = false }: Props) {
  const theme = useTheme();
  const config = CONFIG[state];
  const color = theme.colors[config.colorKey];

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={config.label}
    >
      <Feather name={config.icon} size={14} color={color} />
      {!compact && (
        <Text style={[theme.typography.caption, { color, marginLeft: 6 }]}>{config.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
