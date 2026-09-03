/**
 * theme/zIndex.ts
 * Sección 34/53: estrategia explícita de capas para que bottom sheet, toast,
 * sticky CTA y header no empiecen a pelear cuando se combinen.
 */
export const ZIndex = {
  base: 0,
  contentElevated: 10,
  header: 20,
  sticky: 30,
  dropdown: 40,
  overlay: 50,
  modal: 60,
  sheet: 60, // Alias for modal/drawer mapping
  toast: 70,

  // Legacy aliases
  dock: 40,
} as const;
