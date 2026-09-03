/**
 * theme/breakpoints.ts
 * Sección 62. No depender exclusivamente de estos valores si una pantalla puntual
 * necesita un quiebre distinto — son la referencia base, no una ley física.
 */

export const Breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

/** Anchos de referencia mencionados explícitamente en el spec (sección 11) */
export const ReferenceWidths = {
  mobile: [320, 375, 390, 430],
  tablet: [768, 1024],
  desktop: [1280, 1440, 1920],
} as const;

export const MaxContentWidth = 1400; // sección 61

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

export function getDeviceClass(width: number): DeviceClass {
  if (width >= Breakpoints.desktop) return 'desktop';
  if (width >= Breakpoints.tablet) return 'tablet';
  return 'mobile';
}
