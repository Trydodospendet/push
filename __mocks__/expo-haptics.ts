/** Manual Jest mock: there is no vibration motor in tests. */
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' } as const;
export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;
export const impactAsync = jest.fn(async () => undefined);
export const selectionAsync = jest.fn(async () => undefined);
export const notificationAsync = jest.fn(async () => undefined);
