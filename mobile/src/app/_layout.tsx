import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { initSyncEngine } from '../sync/syncEngine';
import { Colors } from '../constants/theme';

// COMPONENTE DE CARGA / SPLASH CON ANIMACIÓN
function SplashDestellosHada() {
  const scaleValue = useRef(new Animated.Value(0.85)).current;
  const opacityValue = useRef(new Animated.Value(0.4)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    // Animación continua de destello y escala
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 1.15,
            duration: 1100,
            easing: Easing.ease,
            useNativeDriver,
          }),
          Animated.timing(scaleValue, {
            toValue: 0.85,
            duration: 1100,
            easing: Easing.ease,
            useNativeDriver,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 1100,
            useNativeDriver,
          }),
          Animated.timing(opacityValue, {
            toValue: 0.4,
            duration: 1100,
            useNativeDriver,
          }),
        ]),
      ])
    ).start();

    // Rotación suave del resplandor
    Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver,
      })
    ).start();
  }, []);

  const spin = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.splashContainer}>
      <View style={styles.iconCircle}>
        <Animated.View style={{ transform: [{ rotate: spin }], position: 'absolute' }}>
          <Feather name="sun" size={48} color="#C4B5FD" />
        </Animated.View>
        
        <Animated.View style={{ transform: [{ scale: scaleValue }], opacity: opacityValue }}>
          <Ionicons name="sparkles" size={54} color="#7B5CF6" />
        </Animated.View>
      </View>

      <Text style={styles.brandTitle}>Destellos de Hada</Text>
      <Text style={styles.brandSubtitle}>Preparando tu espacio mágico...</Text>
    </View>
  );
}

export default function RootLayout() {
  const { session, status, currentOrganization, organizationLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Sync solo existe mientras hay una sesión autenticada.
  useEffect(() => {
    if (status !== 'authenticated' || !currentOrganization) return;
    return initSyncEngine();
  }, [status, currentOrganization]);

  // 2. Control de navegación según estado de autenticación
  useEffect(() => {
    if (status === 'initializing') return;

    // Type assertion para evitar conflicto de tipos estrictos en Expo Router
    const currentSegment = (segments[0] as string) || '';
    const inAuthGroup = currentSegment === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, status, segments]);

  // Si la app está verificando la sesión, muestra la animación
  if (status === 'initializing' || (status === 'authenticated' && organizationLoading)) {
    return <SplashDestellosHada />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.light.backgroundElement },
        headerTintColor: Colors.light.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.light.background },
      }}
    >
      {/* Autenticación */}
      <Stack.Screen 
        name="(auth)/login" 
        options={{ headerShown: false, animation: 'fade' }} 
      />

      {/* 1. Navegación Principal por Pestañas */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ headerShown: false }} 
      />

      {/* Flujo de Ventas */}
      <Stack.Screen
        name="venta/nueva"
        options={{
          title: 'Nueva venta',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="venta/confirmacion"
        options={{
          title: 'Confirmación',
          headerShown: false,
          gestureEnabled: false,
        }}
      />

    </Stack>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#F7F3ED',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEE7F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#241536',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#3E1F5C',
    fontWeight: '600',
    marginTop: 6,
  },
});
