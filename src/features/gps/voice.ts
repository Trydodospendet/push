import * as Speech from 'expo-speech';
import { useEffect, useRef } from 'react';

import { de } from '@/i18n/de';

import { liveSplits, type TrackPoint } from './geo';

function spokenDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(de.voice.hours(hours));
  }
  if (minutes > 0) {
    parts.push(de.voice.minutes(minutes));
  }
  if (rest > 0 || parts.length === 0) {
    parts.push(de.voice.seconds(rest));
  }
  return parts.join(' ');
}

/** The sentence that is spoken after a full kilometre. */
export function announcementFor(km: number, splitSeconds: number, totalSeconds: number): string {
  return de.voice.announcement(km, spokenDuration(totalSeconds), spokenDuration(splitSeconds));
}

/**
 * Speaks every newly completed kilometre while `enabled`. Kilometres that were already done when
 * the switch is turned on (or the screen opens) are not repeated.
 */
export function useKilometerAnnouncements(
  points: readonly TrackPoint[],
  totalSeconds: number,
  enabled: boolean,
) {
  const spoken = useRef<number | null>(null);
  const splits = liveSplits(points);
  const count = splits.length;

  useEffect(() => {
    if (!enabled) {
      spoken.current = null;
      return;
    }
    if (spoken.current === null) {
      spoken.current = count;
      return;
    }
    if (count > spoken.current) {
      const split = splits[count - 1];
      spoken.current = count;
      Speech.speak(announcementFor(split.km, split.seconds, totalSeconds), { language: 'de-DE' });
    }
    // Only a new kilometre triggers speech; the other values are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, enabled]);
}
