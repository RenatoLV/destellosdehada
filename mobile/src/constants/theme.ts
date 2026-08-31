/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#241536',
    background: '#F7F3ED',
    backgroundElement: '#FFFDF9',
    backgroundSelected: '#EEE7F4',
    textSecondary: '#786F7D',
    primary: '#3E1F5C',
    primarySoft: '#EEE7F4',
    border: '#E3DBD1',
    success: '#2E7655',
    successSoft: '#E7F3EC',
    warning: '#9A5A11',
    warningSoft: '#FFF0DD',
    danger: '#A64242',
    dangerSoft: '#F9E8E8',
  },
  dark: {
    text: '#FFFDF9',
    background: '#241536',
    backgroundElement: '#352143',
    backgroundSelected: '#4A2B5D',
    textSecondary: '#C9BDCC',
    primary: '#D9C2E8',
    primarySoft: '#4A2B5D',
    border: '#533B5F',
    success: '#8ED0AA',
    successSoft: '#214A37',
    warning: '#F2C27D',
    warningSoft: '#5A3D1B',
    danger: '#F0A6A6',
    dangerSoft: '#5A2F35',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
