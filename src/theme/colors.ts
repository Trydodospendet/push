export const colors = {
  bg: '#0A0A0A',
  surface: '#161616',
  surfaceRaised: '#1F1F1F',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#A1A1A1',
  textMuted: '#6B6B6B',
  /** Lime – use sparingly: progress, primary button, success. */
  accent: '#C6FF00',
  /** Text on lime surfaces. */
  onAccent: '#0A0A0A',
  danger: '#FF4D4D',
} as const;

export type ColorToken = keyof typeof colors;

/** Dimmed backdrop behind sheets (the background color with 70 % opacity). */
export const scrim = 'rgba(10, 10, 10, 0.7)';
