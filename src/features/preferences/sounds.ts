import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { getPreferences } from './store';

const SOURCES = {
  tick: require('../../../assets/sounds/tick.wav') as number,
  pop: require('../../../assets/sounds/pop.wav') as number,
  success: require('../../../assets/sounds/success.wav') as number,
} as const;

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();

/**
 * Plays a short tone. Does nothing unless the user switched sounds on (they are off by default),
 * and never throws: a missing audio device must not break a button press.
 */
export function playSound(name: SoundName): void {
  if (!getPreferences().sounds) {
    return;
  }
  try {
    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players.set(name, player);
    }
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Sound is decoration only.
  }
}
