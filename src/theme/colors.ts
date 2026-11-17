export const colors = {
  bg: '#0A0A0A',
  surface: '#151515',
  surfaceRaised: '#1F1F1F',
  border: '#222222',
  text: '#FFFFFF',
  textSecondary: '#9A9A9A',
  /** Lighter than the first design (#6B6B6B) so small texts reach a contrast of about 6:1. */
  textMuted: '#8A8A8A',
  /** Lime – use sparingly: progress, primary button, success. */
  accent: '#C6FF00',
  /** Text on lime surfaces. */
  onAccent: '#0A0A0A',
  danger: '#FF4D4D',
  /** Inactive tab icons. */
  tabInactive: '#6E6E6E',
} as const;

export type ColorToken = keyof typeof colors;

/** Soft lime glow (accent at low opacity): focus halos and success effects. */
export const glow = {
  soft: 'rgba(198, 255, 0, 0.10)',
  strong: 'rgba(198, 255, 0, 0.35)',
  /** Halo around the main button. */
  button: 'rgba(198, 255, 0, 0.35)',
} as const;

/** Dimmed backdrop behind sheets (the background color with 70 % opacity). */
export const scrim = 'rgba(10, 10, 10, 0.7)';

/** Opacity of the lime light at the very top of a screen; it fades to nothing below. */
export const topLightOpacity = 0.09;
