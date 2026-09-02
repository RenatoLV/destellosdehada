/**
 * app/_layout.tsx
 * Fase 3.5 — agrega GestureHandlerRootView (requisito de
 * react-native-gesture-handler, necesario para la Fase 4 con
 * @gorhom/bottom-sheet) y ToastProvider (sección 24) envolviendo la app.
 */
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';

import { AppShell } from '@/components/layout/AppShell';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/context/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { WelcomeSplash } from '@/components/effects/WelcomeSplash';

const SPLASH_SESSION_KEY = 'destellos_welcome_seen_v1';
let nativeSplashSeen = false;

function shouldShowWelcomeSplash() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== '1';
  }
  return !nativeSplashSeen;
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(shouldShowWelcomeSplash);

  const finishWelcomeSplash = () => {
    nativeSplashSeen = true;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    }
    setShowSplash(false);
  };

  // En Web, las fuentes se cargan vía +html.tsx desde public/fonts/ para evitar
  // el bloqueo estricto de Firebase Hosting a rutas con "node_modules".
  const [loaded, error] = useFonts(
    Platform.OS === 'web' ? {} : {
      ...Feather.font,
      ...FontAwesome.font,
    }
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      SplashScreen.hideAsync();
    } else if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error && Platform.OS !== 'web') {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <AppShell>
              <Slot />
            </AppShell>
            <LoginModal />
            {showSplash && <WelcomeSplash onFinish={finishWelcomeSplash} />}
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
