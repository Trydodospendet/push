import { GOAL_TYPES, type GoalType } from '@/config/app';
import { de } from '@/i18n/de';
import { addDays, daysBetween, formatDayLabel, toLocalDate } from '@/lib/dates';

import type { Challenge, ChallengeStatus } from './types';

export function isGoalType(value: string): value is GoalType {
  return (GOAL_TYPES as readonly string[]).includes(value);
}

const distanceFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** e.g. 5000 → '5 km', 21100 → '21,1 km' */
export function formatDistance(metres: number): string {
  return `${distanceFormat.format(metres / 1000)} km`;
}

/** e.g. 10000 → '10.000 Schritte' */
export function formatSteps(steps: number): string {
  return de.goal.steps(integerFormat.format(steps));
}

export function formatTarget(goalType: GoalType, value: number): string {
  return goalType === 'steps_daily' ? formatSteps(value) : formatDistance(value);
}

/** One line describing the goal, e.g. 'Ein Lauf über mindestens 5 km'. */
export function describeGoal(goalType: string, value: number): string {
  if (!isGoalType(goalType)) {
    return '';
  }
  return de.goal.description[goalType](formatTarget(goalType, value));
}

/** The goal rule in plain words for the detail screen. */
export function goalRule(goalType: string, value: number): string {
  if (!isGoalType(goalType)) {
    return '';
  }
  return de.goal.rule[goalType](formatTarget(goalType, value));
}

/** Suggested title for a new challenge, e.g. '5 km am Stück'. */
export function suggestTitle(goalType: GoalType, value: number): string {
  const target = formatTarget(goalType, value);
  switch (goalType) {
    case 'run_single':
      return `${target} am Stück`;
    case 'run_total':
      return `${target} insgesamt`;
    case 'steps_daily':
      return `${target} täglich`;
  }
}

/** First and last day of a challenge as local dates in its timezone. */
export function challengeDays(challenge: Pick<Challenge, 'starts_at' | 'ends_at' | 'timezone'>): {
  firstDay: string;
  lastDay: string;
  days: number;
} {
  const firstDay = toLocalDate(new Date(challenge.starts_at), challenge.timezone);
  // ends_at is the midnight after the last day.
  const endDay = toLocalDate(new Date(challenge.ends_at), challenge.timezone);
  return { firstDay, lastDay: addDays(endDay, -1), days: daysBetween(firstDay, endDay) };
}

/** e.g. 'Fr., 14.11. – Do., 20.11.' */
export function formatPeriod(
  challenge: Pick<Challenge, 'starts_at' | 'ends_at' | 'timezone'>,
): string {
  const { firstDay, lastDay } = challengeDays(challenge);
  return firstDay === lastDay
    ? formatDayLabel(firstDay)
    : `${formatDayLabel(firstDay)} – ${formatDayLabel(lastDay)}`;
}

export function statusLabel(status: string): string {
  return status in de.status ? de.status[status as ChallengeStatus] : status;
}

export function isSolo(challenge: Pick<Challenge, 'mode'>): boolean {
  return challenge.mode === 'solo';
}

export function modeLabel(mode: string): string {
  return mode === 'solo' ? de.mode.solo : de.mode.ranked;
}

/** Settled or cancelled: nothing changes anymore. */
export function isFinished(challenge: Pick<Challenge, 'status'>): boolean {
  return challenge.status === 'settled' || challenge.status === 'cancelled';
}

const percentFormat = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 2,
});

/** Basis points as a percentage, e.g. 1000 → '10 %'. */
export function formatFee(feeBps: number): string {
  return percentFormat.format(feeBps / 10_000);
}

/** Joining and leaving are only possible while the challenge is open and has not started. */
export function isJoinable(challenge: Pick<Challenge, 'status' | 'starts_at'>, now = new Date()) {
  return challenge.status === 'open' && now < new Date(challenge.starts_at);
}
