/**
 * hooks/useHaptics.ts
 * Sección 15: mapeo semántico (light / medium / success / error). No se llama
 * en cada micro-movimiento — solo en las acciones que el spec lista
 * explícitamente (agregar producto, favorito, copiar, continuar, registrar
 * venta, éxito, error).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'light' | 'medium' | 'success' | 'error';

const HAPTIC_MAP: Record<HapticKind, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

/**
 * Devuelve una función estable `trigger(kind)`. En web es un no-op silencioso
 * (expo-haptics no tiene soporte real ahí), así que nunca hace falta chequear
 * la plataforma antes de llamarla.
 */
export function useHaptics() {
  return (kind: HapticKind) => {
    if (Platform.OS === 'web') return;
    HAPTIC_MAP[kind]().catch(() => {
      // Dispositivos sin motor háptico (algunos Android) — no debe romper la UI.
    });
  };
}
