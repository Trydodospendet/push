import { z } from 'zod';

import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  SIGN_IN_CODE_LENGTH,
} from '@/config/app';
import { de } from '@/i18n/de';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: de.signIn.invalidEmail }));

export const signInCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${SIGN_IN_CODE_LENGTH}}$`), { error: de.verify.invalidCode });

/** Same rules as the database: 3–24 characters after trimming, no control characters. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, { error: de.onboarding.nameInvalid })
  .max(DISPLAY_NAME_MAX_LENGTH, { error: de.onboarding.nameInvalid })
  .regex(/^\P{Cc}*$/u, { error: de.onboarding.nameInvalid });

/** Returns the parsed value or the first validation message. */
export function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, message: result.error.issues[0]?.message ?? de.common.genericError };
}
