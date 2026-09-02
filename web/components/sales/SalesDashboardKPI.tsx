/**
 * components/sales/SalesDashboardKPI.tsx
 * Dashboard comercial compacto superior para la vendedora de la joyería.
 * Proporciona visibilidad instantánea de las métricas clave del turno.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { formatCLP } from '@/utils/formatCurrency';

export function SalesDashboardKPI() {
  const theme = useTheme();

  const metrics = [
    {
      label: 'Ventas de hoy',
      value: formatCLP(428990),
      icon: 'trending-up' as const,
      color: '#15803D',
      bg: '#DCFCE7',
      detail: '+12% vs ayer',
    },
    {
      label: 'Productos vendidos',
      value: '8 un.',
      icon: 'shopping-bag' as const,
      color: '#5B21B6',
      bg: '#EDE9FE',
      detail: '6 operaciones',
    },
    {
      label: 'Ticket promedio',
      value: formatCLP(53624),
      icon: 'award' as const,
      color: '#C5A869',
      bg: '#FDF5E6',
      detail: 'Selección destacada',
    },
    {
      label: 'Stock bajo',
      value: '2 productos',
      icon: 'alert-circle' as const,
      color: '#B45309',
      bg: '#FEF3C7',
      detail: 'Vitrina Oro & Éter',
    },
  ];

  return (
    <View style={styles.container}>
      {metrics.map((m, idx) => (
        <View
          key={m.label}
          style={[
            styles.metricCard,
            idx < metrics.length - 1 && styles.metricBorder,
          ]}
        >
          <View style={styles.topRow}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <View style={[styles.iconWrap, { backgroundColor: m.bg }]}>
              <Feather name={m.icon} size={12} color={m.color} />
            </View>
          </View>
          <Text style={styles.metricValue}>{m.value}</Text>
          <Text style={styles.metricDetail}>{m.detail}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE5DE',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  metricCard: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  metricBorder: {
    borderRightWidth: 1,
    borderRightColor: '#F0EBE3',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#736B7E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141218',
  },
  metricDetail: {
    fontSize: 10.5,
    color: '#9B93A6',
    marginTop: 2,
  },
});
