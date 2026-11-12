import type { HealthState } from '../storage';

/**
 * Manual Jest mock for './storage' (activate with `jest.mock('@/features/health/storage')`).
 * By default the explanation screen was already answered, so tests land on the tabs.
 */
export const initialHealthState: HealthState = {
  introDone: false,
  connected: false,
  firstAuthorizedAt: null,
  lastSyncAt: null,
};

let stored: HealthState = { ...initialHealthState, introDone: true };

export const mockHealthState = {
  set(next: Partial<HealthState>) {
    stored = { ...initialHealthState, ...next };
  },
  reset() {
    stored = { ...initialHealthState, introDone: true };
  },
};

export const loadHealthState = jest.fn(async (): Promise<HealthState> => stored);
export const saveHealthState = jest.fn(async (): Promise<void> => undefined);
