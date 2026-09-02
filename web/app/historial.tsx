/**
 * app/historial.tsx
 * Pantalla completa de Historial de Ventas con filtros de fecha, buscador y detalle de venta.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import { saleStorage, type Sale } from '@/services/saleStorage';
import { formatCLP } from '@/utils/formatCurrency';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/context/AuthContext';

type DateFilter = 'hoy' | 'semana' | 'mes' | 'todas';

export default function HistorialScreen() {
  const theme = useTheme();
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = deviceClass === 'desktop';
  const { user } = useAuth();

  const [dateFilter, setDateFilter] = useState<DateFilter>('todas');
  const [query, setQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [allSales, setAllSales] = useState<Sale[]>(() => saleStorage.getAllSales());

  useEffect(() => {
    const localSales = saleStorage.getAllSales();
    setAllSales(localSales);
    if (!user) return;

    let active = true;
    const loadRemoteSales = async () => {
      try {
        const snapshot = await getDocs(
          firestoreQuery(collection(db, 'ventas'), where('userId', '==', user.id))
        );
        const remoteSales = snapshot.docs.map((saleDoc) => saleDoc.data() as Sale);
        const merged = new Map<string, Sale>();
        [...localSales, ...remoteSales].forEach((sale) => {
          if (sale?.id) merged.set(sale.id, sale);
        });
        if (active) {
          setAllSales(
            [...merged.values()].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
        }
      } catch (error) {
        console.warn('No fue posible cargar el historial en línea', error);
      }
    };
    loadRemoteSales();
    return () => {
      active = false;
    };
  }, [user]);

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();

    return allSales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);

      // Filtro de fecha
      if (dateFilter === 'hoy') {
        const isToday = saleDate.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (dateFilter === 'semana') {
        const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (dateFilter === 'mes') {
        const isSameMonth =
          saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        if (!isSameMonth) return false;
      }

      // Filtro de texto
      if (q.length > 0) {
        const matchesId = sale.id.toLowerCase().includes(q) || sale.reference.toLowerCase().includes(q);
        const matchesCustomer = sale.customer.fullName.toLowerCase().includes(q);
        const matchesItems = sale.items.some((i) => i.product.name.toLowerCase().includes(q));
        return matchesId || matchesCustomer || matchesItems;
      }

      return true;
    });
  }, [allSales, dateFilter, query]);

  const totalAmount = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.total, 0),
    [filteredSales]
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <SaleDetailModal
        sale={selectedSale}
        visible={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
      />

      <ScrollView contentContainerStyle={{ padding: isDesktop ? theme.spacing.xl : theme.spacing.md }}>
        {/* Cabecera */}
        <View style={styles.header}>
          <View>
            <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 24 }]}>
              Mis Compras
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>
              Historial de compras y estado de tus pedidos.
            </Text>
          </View>

          {/* Tarjeta de métrica acumulada */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Total acumulado</Text>
            <Text style={[theme.typography.priceLarge, { color: theme.colors.primary, fontSize: 22, marginTop: 2 }]}>
              {formatCLP(totalAmount)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {filteredSales.length} {filteredSales.length === 1 ? 'pedido' : 'pedidos'}
            </Text>
          </View>
        </View>

        {/* Barra de búsqueda y filtros */}
        <View style={[styles.filterBar, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border }]}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color={theme.colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por # de pedido o producto..."
              placeholderTextColor={theme.colors.textSecondary}
              style={[theme.typography.body, { flex: 1, marginLeft: 8, color: theme.colors.text }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Feather name="x" size={14} color={theme.colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <View style={styles.tabsRow}>
            {(['todas', 'hoy', 'semana', 'mes'] as DateFilter[]).map((tab) => {
              const active = dateFilter === tab;
              const labels: Record<DateFilter, string> = {
                todas: 'Todas',
                hoy: 'Hoy',
                semana: 'Esta semana',
                mes: 'Este mes',
              };
              return (
                <Pressable
                  key={tab}
                  onPress={() => setDateFilter(tab)}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: active ? theme.colors.primary : 'transparent',
                      borderRadius: theme.radius.full,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[theme.typography.label, { color: active ? '#FFFFFF' : theme.colors.textSecondary }]}>
                    {labels[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Lista de ventas */}
        {filteredSales.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No tienes compras registradas"
            description="Las compras que realices aparecerán aquí con su detalle y estado."
            actionLabel="Explorar catálogo"
            onAction={() => router.push('/venta')}
          />
        ) : (
          <View style={styles.salesList}>
            {filteredSales.map((sale) => {
              const dateStr = new Date(sale.createdAt).toLocaleDateString('es-CL', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Pressable
                  key={sale.id}
                  onPress={() => setSelectedSale(sale)}
                  style={({ hovered }) => [
                    styles.saleCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.xl,
                      borderColor: theme.colors.border,
                      opacity: hovered ? 0.95 : 1,
                      ...theme.shadows[hovered ? 'cardHover' : 'card'],
                    },
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 18 }]}>
                          #{sale.id}
                        </Text>
                        <Badge variant={sale.synced ? 'success' : 'warning'}>
                          {sale.synced ? 'Sincronizada' : 'Pendiente sync'}
                        </Badge>
                      </View>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                        {dateStr}
                      </Text>
                    </View>

                    <Text style={[theme.typography.priceLarge, { color: theme.colors.text, fontSize: 20 }]}>
                      {formatCLP(sale.total)}
                    </Text>
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.cardBottom}>
                    <View style={{ flex: 1 }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Cliente</Text>
                      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 2 }]} numberOfLines={1}>
                        {sale.customer.fullName || 'Cliente mostrador'}
                      </Text>
                    </View>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Artículos</Text>
                      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 2 }]}>
                        {sale.items.reduce((sum, i) => sum + i.quantity, 0)} productos
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                        <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                          Ver detalle
                        </Text>
                        <Feather name="chevron-right" size={14} color={theme.colors.primary} style={{ marginLeft: 2 }} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metricCard: {
    padding: 16,
    borderWidth: 1,
    minWidth: 180,
    alignItems: 'flex-end',
  },
  filterBar: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabChip: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
  },
  salesList: {
    gap: 12,
  },
  saleCard: {
    padding: 18,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
