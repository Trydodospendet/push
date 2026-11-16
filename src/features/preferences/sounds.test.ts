import { createAudioPlayer } from 'expo-audio';

import { playSound } from './sounds';
import { resetPreferences, setPreference } from './store';

jest.mock('@/lib/secure-storage');

describe('sounds', () => {
  beforeEach(() => {
    resetPreferences();
    jest.mocked(createAudioPlayer).mockClear();
  });

  it('are off by default', () => {
    playSound('pop');
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('play once the user switched them on', async () => {
    await setPreference('sounds', true);
    playSound('pop');
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
  });
});
