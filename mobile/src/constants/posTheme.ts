import { Fonts } from './theme';

export const POSColors = {
  background: '#F7F2EC',
  surface: '#FFFDF9',
  surfaceMuted: '#F2ECE7',
  ink: '#281631',
  muted: '#7F7482',
  plum: '#4D2A60',
  plumSoft: '#EEE6F3',
  lavender: '#8E6BA5',
  rose: '#C48C98',
  roseSoft: '#F7E9EB',
  gold: '#B28745',
  goldSoft: '#F5EDDD',
  border: '#E5DBD2',
  success: '#2F7656',
  successSoft: '#E6F2EB',
  warning: '#9A641B',
  warningSoft: '#FFF1DD',
  danger: '#A54848',
  dangerSoft: '#F9E8E8',
  white: '#FFFFFF',
} as const;

export const POSRadius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const POSTypography = {
  serif: Fonts.serif,
  sans: Fonts.sans,
} as const;
