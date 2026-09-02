/**
 * theme/radius.ts
 * Border radius scale aligned to design spec:
 * sm: 6px (inputs, small badges)
 * md: 10px (buttons, tags, standard controls)
 * lg: 14px (product cards, dialogs)
 * xl: 18px (larger panels)
 * 2xl: 24px (modals, bottom sheets)
 * full: 999px (pills, avatars, circular action buttons)
 */
export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 999,
} as const;
