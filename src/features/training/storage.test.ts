import { loadActivePlan, saveActivePlan } from './storage';

const mockStore = new Map<string, string>();
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => void mockStore.set(key, value),
    removeItem: async (key: string) => void mockStore.delete(key),
  },
}));

describe('active plan storage', () => {
  beforeEach(() => mockStore.clear());

  it('keeps the plan per user and removes it again', async () => {
    await saveActivePlan('a', { planId: '5k_8w', startMonday: '2026-11-16' });
    expect(await loadActivePlan('a')).toEqual({ planId: '5k_8w', startMonday: '2026-11-16' });
    expect(await loadActivePlan('b')).toBeNull();
    await saveActivePlan('a', null);
    expect(await loadActivePlan('a')).toBeNull();
  });

  it('ignores damaged or unknown values', async () => {
    mockStore.set('push.training.a', '{"planId":"marathon","startMonday":"2026-11-16"}');
    expect(await loadActivePlan('a')).toBeNull();
    mockStore.set('push.training.a', 'not json');
    expect(await loadActivePlan('a')).toBeNull();
  });
});
