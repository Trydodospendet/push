import { z } from 'zod';

import {
  CHALLENGE_TITLE_MAX_LENGTH,
  CHALLENGE_TITLE_MIN_LENGTH,
  GOAL_PERIODS,
  GOAL_TYPES,
  INVITE_CODE_LENGTH,
  STAKE_MAX_CENTS,
  STAKE_MIN_CENTS,
  TARGET_LIMITS,
  type GoalPeriod,
} from '@/config/app';
import { de } from '@/i18n/de';
import { addDays } from '@/lib/dates';

/** Same limits as public.create_goal. */
export const createGoalSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(CHALLENGE_TITLE_MIN_LENGTH, { error: de.create.invalidTitle })
      .max(CHALLENGE_TITLE_MAX_LENGTH, { error: de.create.invalidTitle })
      .regex(/^\P{Cc}*$/u, { error: de.create.invalidTitle }),
    goalType: z.enum(GOAL_TYPES),
    targetValue: z.int(),
    stakeCents: z.int().min(STAKE_MIN_CENTS).max(STAKE_MAX_CENTS),
    period: z.enum(GOAL_PERIODS),
  })
  .refine(
    ({ goalType, targetValue }) =>
      targetValue >= TARGET_LIMITS[goalType].min && targetValue <= TARGET_LIMITS[goalType].max,
    { error: de.create.invalidInput, path: ['targetValue'] },
  );

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/**
 * First and last day of a goal period, counted from the user's local date `today`, matching the
 * server-side goal creation rules.
 *   day    today, through local midnight
 *   week   the coming Monday to Sunday
 *   month  the coming calendar month
 */
export function goalPeriodDays(today: string, period: GoalPeriod): { first: string; last: string } {
  const [year, month, day] = today.split('-').map(Number);
  if (period === 'day') {
    return { first: today, last: today };
  }
  if (period === 'week') {
    // ISO weekday of today: Monday = 1 … Sunday = 7.
    const isoWeekday = ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
    const first = addDays(today, 8 - isoWeekday);
    return { first, last: addDays(first, 6) };
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (value: number) => String(value).padStart(2, '0');
  const lastOfMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return {
    first: `${nextYear}-${pad(nextMonth)}-01`,
    last: `${nextYear}-${pad(nextMonth)}-${pad(lastOfMonth)}`,
  };
}

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z0-9]{${INVITE_CODE_LENGTH}}$`), { error: de.joinByCode.invalidCode });
