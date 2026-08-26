import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { initSyncEngine } from '../sync/syncEngine';

// COMPONENTE DE CARGA / SPLASH CON ANIMACIÓN
function SplashDestellosHada() {
  const scaleValue = useRef(new Animated.Value(0.85)).current;
  const opacityValue = useRef(new Animated.Value(0.4)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animación continua de destello y escala
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 1.15,
            duration: 1100,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(scaleValue, {
            toValue: 0.85,
            duration: 1100,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 0.4,
            duration: 1100,
            useNativeDriver: true,
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
        useNativeDriver: true,
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
      <Text style={styles.brandSubtitle}>Cargando tu inventario... ✨</Text>
    </View>
  );
}

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // 1. Inicializar el motor de sincronización en segundo plano
  useEffect(() => {
    initSyncEngine();
  }, []);

  // 2. Control de navegación según estado de autenticación
  useEffect(() => {
    if (loading) return;

    // Type assertion para evitar conflicto de tipos estrictos en Expo Router
    const currentSegment = (segments[0] as string) || '';
    const inAuthGroup = currentSegment === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  // Si la app está verificando la sesión, muestra la animación
  if (loading) {
    return <SplashDestellosHada />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#0F172A',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F8FAFC' },
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

      {/* 2. Flujo de Productos */}
      <Stack.Screen
        name="producto/nuevo"
        options={{
          title: 'Nuevo producto',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="producto/[id]"
        options={{
          title: 'Detalle del producto',
        }}
      />
      <Stack.Screen
        name="producto/editar"
        options={{
          title: 'Editar producto',
        }}
      />
      <Stack.Screen
        name="producto/historial"
        options={{
          title: 'Historial de movimientos',
        }}
      />

      {/* 3. Flujo de Ventas */}
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

      {/* 4. Pantallas Secundarias */}
      <Stack.Screen
        name="categorias/index"
        options={{
          title: 'Categorías',
        }}
      />
      <Stack.Screen
        name="configuracion/index"
        options={{
          title: 'Configuración',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#7B5CF6',
    fontWeight: '600',
    marginTop: 6,
  },
});