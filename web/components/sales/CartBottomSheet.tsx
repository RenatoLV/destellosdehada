import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/theme';
import { useCart } from '@/context/CartContext';
import { CartHeader } from '@/components/sales/CartHeader';
import { CartEmptyState } from '@/components/sales/CartEmptyState';
import { CartItemRow } from '@/components/sales/CartItemRow';
import { CartSummary } from '@/components/sales/CartSummary';
import { useToast } from '@/components/ui/Toast';

type Props = {
  onClose: () => void;
};

export const CartBottomSheet = forwardRef<BottomSheet, Props>(({ onClose }, ref) => {
  const theme = useTheme();
  const toast = useToast();
  const { lines, incrementQty, decrementQty, removeProduct, undoRemove, itemCount } = useCart();
  const isEmpty = lines.length === 0;

  // Snap points for the bottom sheet
  const snapPoints = useMemo(() => ['50%', '90%'], []);

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

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
    >
      <View style={styles.contentContainer}>
        <CartHeader itemCount={itemCount} variant="sheet" onClose={onClose} />

        {isEmpty ? (
          <CartEmptyState onClose={onClose} />
        ) : (
          <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
            {lines.map((line) => (
              <CartItemRow
                key={line.product.id}
                line={line}
                onIncrement={() => incrementQty(line.product.id)}
                onDecrement={() => decrementQty(line.product.id)}
                onRemove={() => handleRemove(line.product.id, line.product.name)}
              />
            ))}
          </BottomSheetScrollView>
        )}

        <CartSummary onContinue={onClose} />
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
