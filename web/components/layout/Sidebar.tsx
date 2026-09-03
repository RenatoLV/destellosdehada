/**
 * components/layout/Sidebar.tsx
 * Sidebar oficial de Destellos de Hada para clientes y compras:
 * - Logo oficial con presencia y proporción correcta
 * - Navegación clara: Explorar catálogo, Mis compras, Favoritos, Más
 * - Perfil de cliente (María José) o botón para Iniciar sesión
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { BrandLogo } from '@/components/brand/BrandLogo';

type NavItem = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  href: string;
};

export function Sidebar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, openLoginModal, logout } = useAuth();

  const navItems: NavItem[] = [
    { label: 'Inicio', icon: 'grid', href: '/' },
    { label: 'Explorar colección', icon: 'shopping-bag', href: '/venta' },
    { label: 'Mis compras', icon: 'package', href: '/historial' },
    { label: 'Favoritos', icon: 'heart', href: '/venta?category=Favoritos' },
    { label: 'Más opciones', icon: 'more-horizontal', href: '/mas' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.sidebarBg, borderRightColor: theme.colors.sidebarBorder }]}>
      {/* Logo oficial */}
      <Pressable onPress={() => router.push('/')} style={styles.brand}>
        <BrandLogo variant="mark" width={82} />
        <Text style={styles.brandName}>Destellos de Hada</Text>
        <Text style={styles.brandCaption}>JOYERÍA · COQUIMBO</Text>
      </Pressable>

      {/* Navegación para clientes */}
      <View style={styles.navSection}>
        {navItems.map((item) => {
          // El match de href exacto o match lógico de tabs principales
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href as never)}
              style={({ hovered, pressed }) => [
                styles.item,
                {
                  backgroundColor: active
                    ? 'rgba(255, 255, 255, 0.10)'
                    : hovered
                    ? theme.colors.sidebarHover
                    : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Feather
                name={item.icon}
                size={18}
                color={active ? '#FFFFFF' : theme.colors.sidebarText}
              />
              {active && <View style={styles.activeMarker} />}
              <Text
                style={[
                  styles.itemText,
                  { color: active ? '#FFFFFF' : theme.colors.sidebarText, fontWeight: active ? '700' : '500' },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bloque inferior: Cuenta de cliente / Iniciar sesión */}
      <View style={[styles.bottomSection, { borderTopColor: theme.colors.sidebarBorder }]}>
        {user ? (
          <View style={styles.profileRow}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={16} color={theme.colors.primaryLight} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user.name || 'Cliente'}
              </Text>
              <Text style={[styles.profileRole, { color: theme.colors.sidebarText }]} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <Pressable
              onPress={logout}
              style={({ hovered }) => [styles.logoutBtn, { backgroundColor: hovered ? theme.colors.sidebarHover : 'transparent' }]}
              accessibilityLabel="Cerrar sesión"
            >
              <Feather name="log-out" size={16} color={theme.colors.sidebarText} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={openLoginModal}
            style={({ hovered }) => [
              styles.loginBtn,
              { backgroundColor: hovered ? theme.colors.primaryLight : theme.colors.primary }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión"
          >
            <Feather name="user" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.loginBtnText}>Iniciar sesión</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 268,
    borderRightWidth: 1,
    paddingTop: 32,
    paddingHorizontal: 18,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  brand: {
    paddingHorizontal: 2,
    marginBottom: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#FFFDF9', fontFamily: 'Cormorant Garamond', fontSize: 22, fontWeight: '600', marginTop: 12 },
  brandCaption: { color: 'rgba(255,255,255,0.45)', fontSize: 8.5, letterSpacing: 2.4, marginTop: 3 },
  navSection: {
    gap: 6,
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    position: 'relative',
    // transition: 'all 0.2s ease', // Soporte para RN web hover/transition - TS doesn't support this by default
  },
  itemText: {
    fontSize: 13.5,
    marginLeft: 14,
    flex: 1,
    letterSpacing: 0.2,
  },
  activeMarker: { position: 'absolute', left: 0, width: 2, height: 20, borderRadius: 2, backgroundColor: '#D7B56D' },
  bottomSection: {
    borderTopWidth: 1,
    paddingTop: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileRole: {
    fontSize: 11,
    marginTop: 2,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    // transition: 'background-color 0.2s ease',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
