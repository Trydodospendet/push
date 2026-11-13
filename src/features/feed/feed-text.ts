import { de } from '@/i18n/de';

import type { FeedEntry } from './api';

const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** "Anna ist 5,2 km gelaufen" – or "Du bist 5,2 km gelaufen" for my own entries. */
export function feedSentence(entry: FeedEntry): string {
  const subject = entry.isMine ? de.feed.you : entry.displayName;
  switch (entry.kind) {
    case 'joined':
      return de.feed.joined(subject, entry.isMine);
    case 'ran':
      return de.feed.ran(subject, kmFormat.format((entry.distanceM ?? 0) / 1000), entry.isMine);
    case 'goal_reached':
      return de.feed.goalReached(subject, entry.isMine);
  }
}
