/**
 * components/layout/Header.tsx
 * Header principal de la boutique Destellos de Hada para clientes.
 */
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, type DeviceClass } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = { deviceClass: DeviceClass };

export function Header({ deviceClass }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const isDesktop = deviceClass === 'desktop';
  const isMobile = deviceClass === 'mobile';
  const reducedMotion = useReducedMotion();
  const cartScale = useSharedValue(1);

  useEffect(() => {
    if (itemCount > 0 && !reducedMotion) {
      cartScale.value = withSequence(
        withSpring(1.12, theme.spring.bouncy),
        withSpring(1, theme.spring.snappy)
      );
    }
  }, [itemCount, reducedMotion]);

  const cartAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: cartScale.value }] }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          paddingHorizontal: isDesktop ? 24 : 16,
          height: isDesktop ? 64 : 56,
        },
      ]}
    >
      <Pressable onPress={() => router.push('/')} style={styles.brand}>
        <BrandLogo variant="mark" width={38} />
        <Text style={[styles.mobileBrandName, { color: theme.colors.primaryDark }]}>Destellos de Hada</Text>
      </Pressable>

      <View style={styles.right}>
        {/* Carrito badge icon en mobile */}
        {!isDesktop && itemCount > 0 && (
          <Pressable
            onPress={() => router.push('/checkout')}
            style={styles.cartIconBtn}
            accessibilityLabel="Ver carrito"
          >
            <Animated.View style={cartAnimatedStyle}>
              <Feather name="shopping-bag" size={18} color={theme.colors.primary} />
            </Animated.View>
            <View style={[styles.badgeCount, { backgroundColor: theme.colors.primary }]}>
              <AnimatedNumber value={String(itemCount)} style={styles.badgeCountText} />
            </View>
          </Pressable>
        )}

        {/* Perfil o botón de login */}
        {user ? (
          <Pressable
            onPress={() => router.push('/historial')}
            style={styles.userProfileBtn}
            accessibilityRole="button"
            accessibilityLabel="Mi cuenta"
          >
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={14} color={theme.colors.primary} />
              </View>
            )}
            {!isMobile && <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/mas')}
            style={styles.loginBtn}
            accessibilityRole="button"
            accessibilityLabel="Abrir cuenta y opciones"
          >
            <Feather name="user" size={17} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 148, height: 42 },
  mobileBrandName: { fontFamily: 'Cormorant Garamond', fontSize: 20, fontWeight: '600', marginLeft: 9 },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#21191C',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0E5E7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#FFFCF7',
    borderWidth: 1,
    borderColor: 'rgba(84, 24, 43, 0.10)',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#21191C',
    marginLeft: 8,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#F3E9DA',
  },
  loginBtnText: {
    color: '#54182B',
    fontSize: 13,
    fontWeight: '600',
  },
});
