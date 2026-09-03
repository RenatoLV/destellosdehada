/**
 * components/sales/CartPanel.tsx
 * Panel del carrito que orquesta CartHeader, CartEmptyState, la lista de CartItemRow y CartSummary.
 * Se adapta para visualización como sidebar fijo en desktop o drawer/bottom-sheet en mobile.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { useCart } from '@/context/CartContext';
import { CartHeader } from '@/components/sales/CartHeader';
import { CartEmptyState } from '@/components/sales/CartEmptyState';
import { CartSummary } from '@/components/sales/CartSummary';
import { CartItemRow } from '@/components/sales/CartItemRow';
import { useToast } from '@/components/ui/Toast';
import Animated, { SlideInRight, SlideOutRight } from 'react-native-reanimated';

type Props = {
  variant: 'sidebar' | 'sheet';
  onClose?: () => void;
};

export function CartPanel({ variant, onClose }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { lines, incrementQty, decrementQty, removeProduct, undoRemove, itemCount } = useCart();
  const isEmpty = lines.length === 0;

  const handleRemove = (productId: string, productName: string) => {
    removeProduct(productId);
    toast.show({
      message: `${productName} eliminado`,
      type: 'info',
      action: {
        label: 'Deshacer',
        onPress: () => {
          undoRemove();
          toast.show({ message: `${productName} restaurado`, type: 'success' });
        },
      },
    });
  };

  const isSidebar = variant === 'sidebar';

  return (
    <Animated.View
      {...(isSidebar ? {
        entering: SlideInRight.springify().damping(20).stiffness(100),
        exiting: SlideOutRight.springify().damping(20).stiffness(100)
      } : {})}
      style={[
        isSidebar ? styles.sidebar : styles.sheet,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: variant === 'sheet' ? theme.radius.xl : 0,
          ...(isSidebar ? { borderLeftWidth: 1 } : theme.shadows.sheet),
        },
      ]}
    >
      <CartHeader itemCount={itemCount} variant={variant} onClose={onClose} />

      {isEmpty ? (
        <CartEmptyState onClose={onClose} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 8 }}>
          {lines.map((line) => (
            <CartItemRow
              key={line.product.id}
              line={line}
              onIncrement={() => incrementQty(line.product.id)}
              onDecrement={() => decrementQty(line.product.id)}
              onRemove={() => handleRemove(line.product.id, line.product.name)}
            />
          ))}
        </ScrollView>
      )}

      <CartSummary onContinue={onClose} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 360, height: '100%', display: 'flex', flexDirection: 'column' },
  sheet: { width: '100%', maxHeight: '85%', display: 'flex', flexDirection: 'column' },
  list: { flex: 1, paddingHorizontal: 20 },
});
