import * as Haptics from 'expo-haptics';

import { secureStorage } from '@/lib/secure-storage';

import { hapticSuccess, hapticTap } from './haptics';
import {
  defaultPreferences,
  getPreferences,
  loadPreferences,
  resetPreferences,
  setPreference,
} from './store';

jest.mock('@/lib/secure-storage');

const store = jest.mocked(secureStorage);

describe('preferences', () => {
  beforeEach(() => {
    resetPreferences();
    store.getItem.mockReset();
    store.setItem.mockReset();
    jest.mocked(Haptics.notificationAsync).mockClear();
    jest.mocked(Haptics.impactAsync).mockClear();
  });

  it('starts with animations and haptics on', async () => {
    store.getItem.mockResolvedValue(null);
    await loadPreferences();
    expect(getPreferences()).toEqual(defaultPreferences);
  });

  it('restores stored settings and ignores damaged ones', async () => {
    store.getItem.mockResolvedValue(JSON.stringify({ animations: false, haptics: true }));
    await loadPreferences();
    expect(getPreferences().animations).toBe(false);

    resetPreferences();
    store.getItem.mockResolvedValue('{"animations":"no"}');
    await loadPreferences();
    expect(getPreferences()).toEqual(defaultPreferences);
  });

  it('saves a change on the phone', async () => {
    await setPreference('haptics', false);
    expect(getPreferences().haptics).toBe(false);
    expect(store.setItem).toHaveBeenCalledWith(
      'push.preferences',
      JSON.stringify({ animations: true, haptics: false }),
    );
  });

  it('vibrates only while haptics are on', async () => {
    hapticSuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);

    await setPreference('haptics', false);
    hapticSuccess();
    hapticTap();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
