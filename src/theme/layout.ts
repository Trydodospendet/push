export const layout = {
  /** Minimum size of anything tappable. */
  minTouchTarget: 44,
  buttonHeight: 56,
  progressBarHeight: 8,
  borderWidth: 1,
  chipHeight: 44,
  iconSize: 24,
} as const;

export const opacity = {
  pressed: 0.85,
  disabled: 0.4,
} as const;

export const motion = {
  /** Subtle transitions only (progress bar, sheets). */
  durationMs: 300,
} as const;
