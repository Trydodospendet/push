import { z } from 'zod';

import {
  CHALLENGE_TITLE_MAX_LENGTH,
  CHALLENGE_TITLE_MIN_LENGTH,
  DURATION_MAX_DAYS,
  DURATION_MIN_DAYS,
  GOAL_TYPES,
  INVITE_CODE_LENGTH,
  STAKE_MAX_CENTS,
  STAKE_MIN_CENTS,
  START_MAX_DAYS_AHEAD,
  START_MIN_DAYS_AHEAD,
  TARGET_LIMITS,
} from '@/config/app';
import { de } from '@/i18n/de';
import { addDays, daysBetween } from '@/lib/dates';

/**
 * Same limits as public.create_challenge. `today` is the current local date in the
 * challenge timezone (the server checks again with its own clock).
 */
export function createChallengeSchema(today: string) {
  return z
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
      startDate: z.iso.date(),
      durationDays: z.int().min(DURATION_MIN_DAYS).max(DURATION_MAX_DAYS),
      visibility: z.enum(['public', 'private']),
    })
    .refine(
      ({ goalType, targetValue }) =>
        targetValue >= TARGET_LIMITS[goalType].min && targetValue <= TARGET_LIMITS[goalType].max,
      { error: de.create.invalidInput, path: ['targetValue'] },
    )
    .refine(
      ({ startDate }) => {
        const ahead = daysBetween(today, startDate);
        return ahead >= START_MIN_DAYS_AHEAD && ahead <= START_MAX_DAYS_AHEAD;
      },
      { error: de.create.invalidInput, path: ['startDate'] },
    );
}

export type CreateChallengeInput = z.infer<ReturnType<typeof createChallengeSchema>>;

/** Last day of a challenge that starts on `startDate` and lasts `durationDays`. */
export function lastDayOf(startDate: string, durationDays: number): string {
  return addDays(startDate, durationDays - 1);
}

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z0-9]{${INVITE_CODE_LENGTH}}$`), { error: de.joinByCode.invalidCode });
