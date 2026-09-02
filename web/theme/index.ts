import { LightColors, type ColorTokens } from './colors';
import { Typography, FontFamily, FontSize, LineHeight } from './typography';
import { Spacing, TouchTarget } from './spacing';
import { Radius } from './radius';
import { LightShadows } from './shadows';
import { Duration, Spring, Interaction, shouldReduceMotion } from './motion';
import { Breakpoints, ReferenceWidths, MaxContentWidth, getDeviceClass } from './breakpoints';
import { ZIndex } from './zIndex';

export * from './colors'; export * from './typography'; export * from './spacing'; export * from './radius';
export * from './shadows'; export * from './motion'; export * from './breakpoints'; export * from './zIndex';

export const LightTheme = {
  mode: 'light' as const, colors: LightColors, shadows: LightShadows, typography: Typography,
  fontFamily: FontFamily, fontSize: FontSize, lineHeight: LineHeight, spacing: Spacing, touchTarget: TouchTarget,
  radius: Radius, duration: Duration, spring: Spring, interaction: Interaction, breakpoints: Breakpoints,
  referenceWidths: ReferenceWidths, maxContentWidth: MaxContentWidth, zIndex: ZIndex,
};

export type Theme = {
  mode: 'light'; colors: ColorTokens; shadows: typeof LightShadows; typography: typeof Typography;
  fontFamily: typeof FontFamily; fontSize: typeof FontSize; lineHeight: typeof LineHeight; spacing: typeof Spacing;
  touchTarget: typeof TouchTarget; radius: typeof Radius; duration: typeof Duration; spring: typeof Spring;
  interaction: typeof Interaction; breakpoints: typeof Breakpoints; referenceWidths: typeof ReferenceWidths;
  maxContentWidth: number; zIndex: typeof ZIndex;
};

export function useTheme(): Theme { return LightTheme; }
export { getDeviceClass, shouldReduceMotion };
