/**
 * components/sales/CartHeader.tsx
 * Cabecera unificada para el panel de carrito (Sidebar desktop y Bottom sheet mobile).
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';

type Props = {
  itemCount: number;
  variant: 'sidebar' | 'sheet';
  onClose?: () => void;
};

export function CartHeader({ itemCount, variant, onClose }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
      {variant === 'sheet' && <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />}

      <View style={styles.content}>
        <View style={styles.titleGroup}>
          <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 20, fontWeight: '700' }]}>
            Tu selección
          </Text>
          {itemCount > 0 && (
            <Badge variant="info" style={{ marginLeft: 8 }}>
              {`${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
            </Badge>
          )}
        </View>

        {onClose && (
          <IconButton
            icon={variant === 'sidebar' ? 'chevron-right' : 'x'}
            size={16}
            onPress={onClose}
            accessibilityLabel="Ocultar selección"
            backgroundColor={theme.colors.background}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
