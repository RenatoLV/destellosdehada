/**
 * app/pendientes.tsx
 * Pantalla de Ventas Pendientes de Sincronización con acción de sincronización manual.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { saleStorage, type Sale } from '@/services/saleStorage';
import { formatCLP } from '@/utils/formatCurrency';

export default function PendientesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [sales, setSales] = useState<Sale[]>(() => saleStorage.getPendingSales());
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = sales.length;
  const pendingTotal = useMemo(() => sales.reduce((sum, s) => sum + s.total, 0), [sales]);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const result = await saleStorage.syncAllPending();
      setSales(saleStorage.getPendingSales());
      toast.show({
        message: `¡${result.syncedCount} ventas sincronizadas exitosamente!`,
        type: 'success',
      });
    } catch (e) {
      toast.show({ message: 'Error al sincronizar. Reintentando...', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <View style={styles.header}>
          <View>
            <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 24 }]}>
              Ventas Pendientes
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>
              Ventas registradas localmente en modo offline pendientes de subir a la nube.
            </Text>
          </View>

          {pendingCount > 0 && (
            <Button
              label={isSyncing ? 'Sincronizando...' : 'Sincronizar todo'}
              onPress={handleSyncAll}
              loading={isSyncing}
              variant="primary"
              icon="refresh-cw"
            />
          )}
        </View>

        {pendingCount === 0 ? (
          <EmptyState
            icon="check-circle"
            title="Todo sincronizado"
            description="No existen ventas pendientes en este dispositivo. Todas las operaciones están respaldadas."
          />
        ) : (
          <View style={{ gap: 16 }}>
            <View style={[styles.banner, { backgroundColor: theme.colors.lavender, borderRadius: theme.radius.lg }]}>
              <Feather name="info" size={18} color={theme.colors.primary} />
              <Text style={[theme.typography.body, { color: theme.colors.primary, marginLeft: 10, flex: 1 }]}>
                Hay <Text style={{ fontWeight: '700' }}>{pendingCount} ventas ({formatCLP(pendingTotal)})</Text> almacenadas en la base local esperando conexión.
              </Text>
            </View>

            <View style={styles.list}>
              {sales.map((sale) => (
                <View
                  key={sale.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.lg,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 16 }]}>
                      Venta #{sale.id}
                    </Text>
                    <Text style={[theme.typography.priceLarge, { color: theme.colors.text, fontSize: 18 }]}>
                      {formatCLP(sale.total)}
                    </Text>
                  </View>

                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                    Cliente: {sale.customer.fullName || 'Cliente mostrador'} • {sale.items.length} productos
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
