import { QUICK_GOALS, type QuickGoalScope } from '@/config/app';
import { formatTarget, suggestTitle } from '@/features/challenges/format';
import { de } from '@/i18n/de';
import { addDays } from '@/lib/dates';

export type QuickGoal = (typeof QUICK_GOALS)[number];

/** First and last local day of a quick goal: today until midnight, or today until Sunday. */
export function quickGoalDates(
  today: string,
  scope: QuickGoalScope,
): { first: string; last: string } {
  if (scope === 'today') {
    return { first: today, last: today };
  }
  const [year, month, day] = today.split('-').map(Number);
  const isoWeekday = ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
  return { first: today, last: addDays(today, 7 - isoWeekday) };
}

/** The big number of a suggestion card, e.g. '3 km' or '8.000 Schritte'. */
export function quickGoalTarget(goal: QuickGoal): string {
  return formatTarget(goal.goalType, goal.targetValue);
}

/** The small line of a suggestion card, e.g. 'heute'. */
export function quickGoalScopeLabel(goal: QuickGoal): string {
  return goal.scope === 'today' ? de.pledge.scopeToday : de.pledge.scopeWeek;
}

/** Title stored with the goal, e.g. '3 km laufen · heute' (at most 60 characters). */
export function quickGoalTitle(goal: QuickGoal): string {
  return `${suggestTitle(goal.goalType, goal.targetValue)} · ${quickGoalScopeLabel(goal)}`;
}
