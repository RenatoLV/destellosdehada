/**
 * app/mas.tsx
 * Pantalla de Más Información, Garantía, Cuidados y Contacto para clientes de Destellos de Hada.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function MasScreen() {
  const theme = useTheme();
  const { user, openLoginModal, logout } = useAuth();

  const INFO_SECTIONS = [
    {
      icon: 'shield' as const,
      title: 'Selección y calidad',
      description: 'Revisamos materiales, presentación y terminaciones según cada categoría antes de entregar tu pedido.',
    },
    {
      icon: 'package' as const,
      title: 'Envíos y Entregas',
      description: 'Despachos a todo Chile con embalaje protegido y una presentación adecuada para cada producto.',
    },
    {
      icon: 'star' as const,
      title: 'Cuidado de tus productos',
      description: 'Te orientamos con el cuidado indicado para conservar mejor cada joya, perfume o prenda.',
    },
    {
      icon: 'message-circle' as const,
      title: 'Atención Personalizada',
      description: '¿Dudas sobre tallas o pedidos especiales? Escríbenos a contacto@destellosdehada.cl',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BrandLogo variant="full" width={230} />
        <Text style={styles.subtitle}>Boutique de joyas, perfumes y moda</Text>
      </View>

      {/* Tarjeta de Cuenta de Cliente */}
      <View style={styles.accountCard}>
        <View style={styles.accountRow}>
          <View style={styles.accountIcon}>
            <Feather name="user" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.accountTitle}>
              {user ? user.name : 'Tu cuenta'}
            </Text>
            <Text style={styles.accountSubtitle}>
              {user ? user.email : 'Inicia sesión para guardar tus compras y favoritos'}
            </Text>
          </View>
        </View>

        {user ? (
          <Pressable onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        ) : (
          <Pressable onPress={openLoginModal} style={styles.loginBtn}>
            <Text style={styles.loginText}>Iniciar sesión / Registrarse</Text>
          </Pressable>
        )}
      </View>

      {/* Secciones de Información */}
      <View style={styles.cardsGrid}>
        {INFO_SECTIONS.map((item) => (
          <View key={item.title} style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Feather name={item.icon} size={18} color={theme.colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF5EB',
  },
  content: {
    padding: 24,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#65575B',
    marginTop: 10,
    textAlign: 'center',
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(84, 24, 43, 0.12)',
    padding: 20,
    marginBottom: 24,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTitle: {
    fontFamily: 'Cormorant Garamond',
    fontSize: 20,
    fontWeight: '600',
    color: '#21191C',
  },
  accountSubtitle: {
    fontSize: 12.5,
    color: '#65575B',
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: '#54182B',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#F0E5E7',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#65575B',
    fontSize: 13,
    fontWeight: '600',
  },
  cardsGrid: {
    gap: 14,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(84, 24, 43, 0.12)',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0E5E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontFamily: 'Cormorant Garamond',
    fontSize: 19,
    fontWeight: '600',
    color: '#21191C',
  },
  cardDesc: {
    fontSize: 13,
    color: '#65575B',
    lineHeight: 19,
  },
});
