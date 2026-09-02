/**
 * app/checkout.tsx
 * Pantalla principal del flujo de Checkout (Cliente -> Transferencia -> Comprobante -> Confirmación).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { CustomerForm } from '@/components/checkout/CustomerForm';
import { TransferStep } from '@/components/checkout/TransferStep';
import { ReceiptStep } from '@/components/checkout/ReceiptStep';
import { SaleConfirmation } from '@/components/checkout/SaleConfirmation';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { uploadReceiptToDrive } from '@/services/uploadService';
import { useToast } from '@/components/ui/Toast';
import { formatCLP } from '@/utils/formatCurrency';
import {
  saleStorage,
  type CustomerData,
  type ReceiptData,
  type Sale,
} from '@/services/saleStorage';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 1, label: 'Resumen', icon: 'shopping-bag' as const },
  { id: 2, label: 'Cliente', icon: 'user' as const },
  { id: 3, label: 'Pago', icon: 'credit-card' as const },
  { id: 4, label: 'Comprobante', icon: 'upload' as const },
  { id: 5, label: 'Listo', icon: 'check' as const },
];

export default function CheckoutScreen() {
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = deviceClass === 'desktop';
  const { lines, subtotal, discount, discountAmount, total, clear } = useCart();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [customer, setCustomer] = useState<CustomerData>({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [receipt, setReceipt] = useState<ReceiptData | undefined>(undefined);
  const [createdSale, setCreatedSale] = useState<Sale | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const { id: saleId, reference } = useMemo(() => saleStorage.generateSaleId(), []);

  // Si no hay items y aún estamos en los primeros pasos, redirigir a venta
  if (lines.length === 0 && step < 5 && !createdSale) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <Feather name="shopping-bag" size={40} color={theme.colors.textSecondary} />
        <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, marginTop: 16 }]}>
          No tienes productos en el carrito
        </Text>
        <Pressable
          onPress={() => router.push('/venta')}
          style={[styles.returnBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.full }]}
        >
          <Text style={[theme.typography.bodyMedium, { color: '#FFFFFF' }]}>Ir al catálogo</Text>
        </Pressable>
      </View>
    );
  }

  const handleConfirmSale = async () => {
    if (isConfirming) return; // Prevent double-click race conditions
    setIsConfirming(true);

    try {
      let finalReceipt = receipt;

      // Si hay un comprobante adjunto localmente, lo subimos a Google Drive
      if (receipt && receipt.previewUri && !receipt.previewUri.startsWith('http')) {
        // En caso de react-native web object URL (blob:http) o URI local (file://)
        const publicUrl = await uploadReceiptToDrive(
          receipt.previewUri,
          receipt.fileName,
          receipt.fileType
        );

        finalReceipt = {
          ...receipt,
          previewUri: publicUrl // Guardamos la URL pública generada por Google Drive
        };
      }

      const newSale: Sale = {
        id: saleId,
        reference,
        createdAt: new Date().toISOString(),
        items: [...lines],
        subtotal,
        discount,
        discountAmount,
        total,
        customer,
        receipt: finalReceipt,
        status: 'CONFIRMADA',
        synced: false,
        syncAttempts: 0,
        ...(user ? { userId: user.id } : {}),
      };

      saleStorage.saveSale(newSale);
      setCreatedSale(newSale);
      clear();
      setStep(5);
    } catch (error: any) {
      toast.show({ message: 'Error al procesar la venta: ' + error.message, type: 'error' });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleNewSale = () => {
    router.push('/venta');
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Header superior con botón volver */}
      <View style={[styles.topBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {step < 5 ? (
          <Pressable
            onPress={() => {
              if (step === 1) router.push('/venta');
              else setStep((s) => (s - 1) as Step);
            }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver al paso anterior"
          >
            <Feather name="chevron-left" size={20} color={theme.colors.text} />
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginLeft: 4 }]}>
              {isDesktop ? (step === 1 ? 'Volver al catálogo' : 'Atrás') : 'Volver'}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <View style={styles.checkoutBrand}>
          <Feather name="lock" size={13} color={theme.colors.champagneAccessible} />
          <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 18 }]}>Compra segura</Text>
        </View>

        <View style={{ minWidth: 60, alignItems: 'flex-end' }}>
          {step < 5 && (
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
              {formatCLP(total)}
            </Text>
          )}
        </View>
      </View>

      {/* Stepper de progreso */}
      {step < 5 && (
        <View style={[styles.stepperContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {isDesktop ? <View style={styles.stepper}>
            {STEPS.map((s, idx) => {
              const isCurrent = step === s.id;
              const isPast = step > s.id;
              return (
                <View key={s.id} style={styles.stepItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={[
                        styles.stepCircle,
                        {
                          backgroundColor: isCurrent
                            ? theme.colors.primary
                            : isPast
                            ? theme.colors.success
                            : theme.colors.border,
                          borderRadius: theme.radius.full,
                        },
                      ]}
                    >
                      <Feather
                        name={isPast ? 'check' : s.icon}
                        size={12}
                        color={isCurrent || isPast ? '#FFFFFF' : theme.colors.textSecondary}
                      />
                    </View>
                    {isDesktop && <Text
                      style={[
                        theme.typography.caption,
                        {
                          color: isCurrent ? theme.colors.primary : isPast ? theme.colors.text : theme.colors.textSecondary,
                          fontWeight: isCurrent ? '700' : '400',
                          marginLeft: 6,
                        },
                      ]}
                    >
                      {s.label}
                    </Text>}
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: isPast ? theme.colors.success : theme.colors.border },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View> : (
            <View style={styles.mobileProgress}>
              <View style={styles.mobileProgressCopy}>
                <Text style={[theme.typography.label, { color: theme.colors.primary }]}>Paso {step} de 4</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{STEPS[step - 1].label}</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: theme.colors.primary, width: `${step * 25}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {/* Contenido dinámico según el paso */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <OrderSummary onNext={() => setStep(2)} />
        )}

        {step === 2 && (
          <CustomerForm data={customer} onChange={setCustomer} onNext={() => setStep(3)} />
        )}

        {step === 3 && (
          <TransferStep total={total} reference={reference} onNext={() => setStep(4)} />
        )}

        {step === 4 && (
          <ReceiptStep
            receipt={receipt}
            onReceiptChange={setReceipt}
            onConfirm={handleConfirmSale}
            loading={isConfirming}
          />
        )}

        {step === 5 && createdSale && (
          <SaleConfirmation sale={createdSale} onNewSale={handleNewSale} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  returnBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  topBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  checkoutBrand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  stepperContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
  },
  mobileProgress: { width: '100%', paddingHorizontal: 18, gap: 9 },
  mobileProgressCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { width: '100%', height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  scrollContent: {
    paddingVertical: 20,
  },
});
