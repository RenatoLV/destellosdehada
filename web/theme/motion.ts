/**
 * theme/motion.ts
 * Motion System (sección 56) + presets de Reanimated (sección 57: reduced motion).
 */

export const Duration = {
  fast: 150,
  normal: 250,
  emphasis: 400,
  success: 800, // animación de éxito: 600–1200ms (sección 40); 800ms es el punto medio
} as const;

/** Presets de withSpring (react-native-reanimated) */
export const Spring = {
  gentle: { damping: 18, stiffness: 180, mass: 1 },
  snappy: { damping: 14, stiffness: 220, mass: 0.9 }, // press mobile (sección 21): scale 0.97
  bouncy: { damping: 10, stiffness: 150, mass: 1 }, // toast, sparkles
} as const;

/** Valores de press/hover reutilizados en varios componentes */
export const Interaction = {
  pressScale: 0.97, // sección 21
  hoverImageScale: 1.02, // sección 20
  hoverCardTranslateY: -2, // sección 20
} as const;

/**
 * Cuando el usuario tiene reduced motion activo (sección 57), los componentes deben
 * consultar esto y desactivar partículas/desplazamientos, manteniendo solo feedback
 * funcional (ej. cambio de color/ícono en vez de animación de posición).
 */
export const shouldReduceMotion = (systemPrefersReducedMotion: boolean) => systemPrefersReducedMotion;
