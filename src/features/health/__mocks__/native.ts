import type { HealthAdapter, HealthSnapshot } from '../types';

/**
 * Manual Jest mock for './native' (activate with `jest.mock('@/features/health/native')`).
 * The real adapters need HealthKit / Health Connect, which do not exist in Jest.
 */
const emptySnapshot: HealthSnapshot = { workouts: [], days: [] };

export const mockAdapter = {
  available: jest.fn(async (): Promise<boolean> => true),
  authorize: jest.fn(async (): Promise<boolean> => true),
  read: jest.fn(async (): Promise<HealthSnapshot> => emptySnapshot),
} satisfies HealthAdapter;

export const getHealthAdapter = jest.fn(async (): Promise<HealthAdapter> => mockAdapter);
