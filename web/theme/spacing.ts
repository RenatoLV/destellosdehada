/**
 * theme/spacing.ts
 * Base 4px scale. Whitespace es parte del "lujo" (sección 9) así que se usa
 * generosamente, en especial xl/xxl para separar secciones en desktop.
 */
export const Spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,

  // Aliases for compatibility
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/** Touch target mínimo (sección 12): ~44px */
export const TouchTarget = {
  min: 44,
} as const;
