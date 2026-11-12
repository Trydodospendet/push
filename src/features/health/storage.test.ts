import { secureStorage } from '@/lib/secure-storage';

import { initialHealthState, loadHealthState, saveHealthState } from './storage';

jest.mock('@/lib/secure-storage');

const store = jest.mocked(secureStorage);

describe('health state storage', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
  });

  it('starts with nothing connected', async () => {
    store.getItem.mockResolvedValue(null);
    await expect(loadHealthState('user-1')).resolves.toEqual(initialHealthState);
    expect(initialHealthState.introDone).toBe(false);
    expect(initialHealthState.connected).toBe(false);
  });

  it('keeps one state per account', async () => {
    const state = { ...initialHealthState, introDone: true, connected: true };
    await saveHealthState('user-1', state);
    expect(store.setItem).toHaveBeenCalledWith('push.health.user-1', JSON.stringify(state));

    store.getItem.mockResolvedValue(JSON.stringify(state));
    await expect(loadHealthState('user-1')).resolves.toEqual(state);
    expect(store.getItem).toHaveBeenCalledWith('push.health.user-1');
  });

  it.each(['not json', '{"introDone":"yes"}', '[]'])('ignores damaged value %p', async (raw) => {
    store.getItem.mockResolvedValue(raw);
    await expect(loadHealthState('user-1')).resolves.toEqual(initialHealthState);
  });
});
