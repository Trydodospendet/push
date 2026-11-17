export const layout = {
  /** Minimum size of anything tappable. */
  minTouchTarget: 44,
  buttonHeight: 56,
  /** Height of the tab bar without the space for the system navigation. */
  tabBarHeight: 60,
  progressBarHeight: 8,
  borderWidth: 1,
  chipHeight: 44,
  iconSize: 24,
  /** Initials-in-a-circle avatars. */
  avatar: { sm: 32, md: 44, lg: 80, xl: 136 },
  /** Progress ring on the home screen. */
  ring: { size: 252, holeShare: 0.7, stroke: 12 },
  /** Bars of the weekly chart. */
  chart: { height: 96, barWidth: 20, minBarHeight: 4 },
  /** Large icon inside the onboarding pages and empty states. */
  illustration: { size: 144, iconSize: 64, compactSize: 88 },
} as const;

export const opacity = {
  pressed: 0.85,
  disabled: 0.4,
} as const;

export const motion = {
  /** Subtle transitions only (progress bar, sheets). */
  durationMs: 300,
  /** The win celebration is the one place that may take longer. */
  celebrationMs: 700,
} as const;
