/** Manual Jest mock: the real module needs the native location service. */
export const Accuracy = { BestForNavigation: 6 } as const;
export const ActivityType = { Fitness: 3 } as const;

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  granted: true,
  canAskAgain: true,
  status: 'granted',
}));
export const getForegroundPermissionsAsync = jest.fn(async () => ({
  granted: true,
  canAskAgain: true,
  status: 'granted',
}));
export const startLocationUpdatesAsync = jest.fn(async () => undefined);
export const stopLocationUpdatesAsync = jest.fn(async () => undefined);
export const hasStartedLocationUpdatesAsync = jest.fn(async () => false);

export type LocationObject = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
  mocked?: boolean;
};
