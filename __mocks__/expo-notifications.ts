/** Manual Jest mock: the real module needs the native notification service. */
export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
}

export enum AndroidImportance {
  DEFAULT = 3,
}

export const SchedulableTriggerInputTypes = { DATE: 'date' } as const;

export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(async () => null);
export const getPermissionsAsync = jest.fn(async () => ({
  status: PermissionStatus.UNDETERMINED,
  canAskAgain: true,
}));
export const requestPermissionsAsync = jest.fn(async () => ({
  status: PermissionStatus.GRANTED,
  canAskAgain: true,
}));
export const cancelAllScheduledNotificationsAsync = jest.fn(async () => undefined);
export const scheduleNotificationAsync = jest.fn(async () => 'id');
export const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const getExpoPushTokenAsync = jest.fn(async () => ({ data: 'ExponentPushToken[test]' }));
