import { de } from '@/i18n/de';

import type { CommunityEvent } from './api';

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** "Jemand ist 5 km gelaufen" or "Jemand hat 3 km geschafft": always anonymous. */
export function eventText(event: CommunityEvent): string {
  if (event.kind === 'run') {
    return de.community.ran(numberFormat.format(event.value));
  }
  const goal = event.goalType?.startsWith('steps')
    ? `${numberFormat.format(event.value)} ${de.progress.unitSteps}`
    : `${kmFormat.format(event.value / 1000)} km`;
  return de.community.reached(goal);
}

/** "gerade eben", "vor 25 Min.", "vor 3 Std.". */
export function agoText(at: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000));
  if (minutes < 10) return de.community.justNow;
  if (minutes < 60) return de.community.minutesAgo(minutes);
  return de.community.hoursAgo(Math.floor(minutes / 60));
}
