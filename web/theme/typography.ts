/**
 * theme/typography.ts
 * Destellos de Hada — Design System · Typography Tokens
 *
 * Regla (sección 10): DISPLAY = emoción, SANS = funcionalidad.
 *
 * El spec deja las familias como "a evaluar" (varias opciones). Elegimos una por
 * defecto de cada lista para poder tipar el sistema — son fáciles de cambiar acá
 * sin tocar el resto de la app. Cárgalas con expo-font / @expo-google-fonts.
 */

import { Platform } from 'react-native';

export const FontFamily = {
  display: Platform.select({
    web: "'Cormorant Garamond', Georgia, serif",
    default: 'serif',
  }),
  displayRegular: Platform.select({
    web: "'Cormorant Garamond', Georgia, serif",
    default: 'serif',
  }),
  ui: Platform.select({
    web: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    default: 'System',
  }),
  uiMedium: Platform.select({
    web: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    default: 'System',
  }),
  uiSemiBold: Platform.select({
    web: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    default: 'System',
  }),
} as const;

/**
 * Escala tipográfica. No está definida numéricamente en el spec (solo el criterio
 * display/sans), así que esta escala es una propuesta razonable para joyería premium:
 * pasos generosos, mucho aire — ajustable en Fase 14 (Polish).
 */
export const FontSize = {
  displayXL: 48, // Handled dynamically in components (e.g., via useWindowDimensions or clamp in web)
  displayL: 30, // Section Headings (H2): 28-32px
  displayM: 22, // Subheadings (H3): 20-24px
  bodyL: 16, // Body/Inputs Large
  bodyM: 14, // Body/Inputs Standard
  bodyS: 13, // Small/Caption Large
  caption: 12, // Small/Caption Small
} as const;

export const LineHeight = {
  displayXL: 48 * 1.1,
  displayL: 30 * 1.2, // Line-height: 1.2
  displayM: 22 * 1.25, // Line-height: 1.25
  bodyL: 16 * 1.5, // Line-height: 1.5
  bodyM: 14 * 1.5,
  bodyS: 13 * 1.3, // Line-height: 1.3
  caption: 12 * 1.3,
} as const;

export const Typography = {
  heroTitle: { fontFamily: FontFamily.display, fontSize: FontSize.displayXL, lineHeight: LineHeight.displayXL },
  sectionTitle: { fontFamily: FontFamily.display, fontSize: FontSize.displayL, lineHeight: LineHeight.displayL },
  productName: { fontFamily: FontFamily.displayRegular, fontSize: FontSize.displayM, lineHeight: LineHeight.displayM },
  priceLarge: { fontFamily: FontFamily.uiSemiBold, fontSize: FontSize.bodyL, lineHeight: LineHeight.bodyL },
  body: { fontFamily: FontFamily.ui, fontSize: FontSize.bodyM, lineHeight: LineHeight.bodyM },
  bodyMedium: { fontFamily: FontFamily.uiMedium, fontSize: FontSize.bodyM, lineHeight: LineHeight.bodyM },
  label: { fontFamily: FontFamily.uiMedium, fontSize: FontSize.bodyS, lineHeight: LineHeight.bodyS },
  caption: { fontFamily: FontFamily.ui, fontSize: FontSize.caption, lineHeight: LineHeight.caption },
} as const;
