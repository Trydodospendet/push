import type { GoalType } from '@/config/app';
import { de } from '@/i18n/de';

const kmFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ProgressNumbers = {
  /** e.g. '3,25' */
  current: string;
  /** e.g. '5,00' */
  goal: string;
  /** e.g. 'km' */
  unit: string;
  /** Screen reader text, e.g. '3,25 von 5,00 km' */
  spoken: string;
};

/**
 * The server stores metres for runs and "days reached" for steps_daily. This only formats
 * what the server computed; it never decides who reached the goal.
 */
export function progressNumbers(
  goalType: GoalType,
  value: number,
  target: number,
  totalDays: number,
): ProgressNumbers {
  const isSteps = goalType === 'steps_daily';
  const current = isSteps ? integerFormat.format(value) : kmFormat.format(value / 1000);
  const goal = isSteps ? integerFormat.format(totalDays) : kmFormat.format(target / 1000);
  const unit = isSteps ? de.progress.unitDays : de.progress.unitKm;
  return { current, goal, unit, spoken: de.progress.spoken(current, `${goal} ${unit}`) };
}

/** Share of the goal (0 to 1) for the progress bar. */
export function progressRatio(
  goalType: GoalType,
  value: number,
  target: number,
  totalDays: number,
): number {
  const denominator = goalType === 'steps_daily' ? totalDays : target;
  if (denominator <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / denominator));
}

const STATUS_ORDER: Record<string, number> = { active: 0, settling: 1, open: 2 };

/** The challenge for the big number on Home: running first, then ending, then next to start. */
export function pickPrimaryChallenge<T extends { status: string; starts_at: string }>(
  challenges: readonly T[],
): T | undefined {
  return [...challenges]
    .filter((challenge) => challenge.status in STATUS_ORDER)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.starts_at.localeCompare(b.starts_at),
    )[0];
}

/** e.g. 'Noch 3 Tage', 'Noch 5 Stunden'. */
export function remainingLabel(endsAt: Date, now: Date): string {
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) {
    return de.progress.ended;
  }
  if (remaining >= 2 * DAY_MS) {
    return de.progress.remainingDays(Math.floor(remaining / DAY_MS));
  }
  if (remaining >= HOUR_MS) {
    return de.progress.remainingHours(Math.floor(remaining / HOUR_MS));
  }
  return de.progress.remainingMinutes(Math.max(1, Math.floor(remaining / 60_000)));
}
