/** Paleta editorial marfil, burdeos y champagne. Champagne es solo decorativo. */
const Brand = {
  wine950: '#2A0C16', wine900: '#3B111F', wine800: '#54182B', wine700: '#6F2138', wine600: '#8B2F4B',
  ivory50: '#FFFCF7', ivory100: '#FBF5EB', ivory200: '#F3E9DA',
  champagne: '#D7B56D', champagneSoft: '#EAD7A9', ink: '#21191C',
} as const;

export const LightColors = {
  background: Brand.ivory100, surface: Brand.ivory50, ivory: Brand.ivory100, elevated: '#FFFFFF', surfaceSubdued: Brand.ivory200,
  primary: Brand.wine800, primaryLight: Brand.wine600, primaryDark: Brand.wine950,
  secondary: '#78635B', accent: Brand.champagne,
  text: Brand.ink, textSecondary: '#65575B', textMuted: '#8A7C80', textInverse: '#FFFDF9',
  champagne: Brand.champagne, champagneLight: Brand.champagneSoft, champagneAccessible: Brand.wine700, gold: Brand.champagne,
  border: 'rgba(84, 24, 43, 0.12)', borderStrong: 'rgba(84, 24, 43, 0.28)', borderSubtle: 'rgba(84, 24, 43, 0.07)',
  success: '#28624B', successLight: '#E5F1EB', warning: '#825A12', warningLight: '#F7EDD5', error: '#A3343C', errorLight: '#F6E3E3',
  offer: '#A3343C', new: '#4D456F', lowStock: '#825A12', soldOut: '#625B5E',
  sidebarBg: Brand.wine950, sidebarActive: Brand.wine800, sidebarHover: 'rgba(255, 255, 255, 0.07)',
  sidebarBorder: 'rgba(234, 215, 169, 0.16)', sidebarText: 'rgba(255, 253, 249, 0.72)', sidebarTextActive: '#FFFDF9',
  lavender: '#F0E5E7', rose: '#F6E3E3', pink: '#FBF1F2',
} as const;

export type ColorTokens = Record<keyof typeof LightColors, string>;
