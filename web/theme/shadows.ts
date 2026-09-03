/**
 * theme/shadows.ts
 * RN-style shadow objects (iOS: shadow*, Android: elevation).
 *
 * Sombras suaves para el único tema claro de la boutique.
 */

import { Platform } from 'react-native';

const shadowLightExact = (css: string, opacity: number, radius: number, offsetY: number) => {
  if (Platform.OS === 'web') {
    return { boxShadow: css };
  }
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: Math.round(radius / 2),
  };
};

export const LightShadows = {
  // Strict Semantic Tokens from Design System
  sm: shadowLightExact('0 1px 2px rgba(0, 0, 0, 0.04)', 0.04, 2, 1),
  md: shadowLightExact('0 4px 12px rgba(0, 0, 0, 0.06)', 0.06, 12, 4),
  lg: shadowLightExact('0 12px 32px rgba(0, 0, 0, 0.08)', 0.08, 32, 12),

  // Aliases / Additional functional shadows
  card: shadowLightExact('0 4px 12px rgba(0, 0, 0, 0.06)', 0.06, 12, 4), // Maps to md
  cardHover: shadowLightExact('0 12px 32px rgba(0, 0, 0, 0.08)', 0.08, 32, 12), // Maps to lg
  sheet: shadowLightExact('0 -4px 24px rgba(0, 0, 0, 0.10)', 0.10, 24, -4),
  dialog: shadowLightExact('0 12px 32px rgba(0, 0, 0, 0.08)', 0.08, 32, 12),
} as const;
