import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import { de } from '@/i18n/de';

/** Error messages raised by our Postgres functions (`raise exception using message = …`). */
const databaseErrorMessages: Record<string, string> = {
  ...de.serverErrors,
  ...de.health.errors,
  invalid_display_name: de.onboarding.nameInvalid,
  invalid_title: de.create.invalidTitle,
  invalid_goal_type: de.create.invalidInput,
  invalid_target_value: de.create.invalidInput,
  invalid_stake: de.create.invalidInput,
  invalid_start_date: de.create.invalidInput,
  invalid_duration: de.create.invalidInput,
  invalid_visibility: de.create.invalidInput,
  invalid_max_participants: de.create.invalidInput,
};

/** Supabase Auth error codes, see https://supabase.com/docs/guides/auth/debugging/error-codes */
const authErrorMessages: Record<string, string> = {
  otp_expired: de.verify.wrongCode,
  invalid_credentials: de.signIn.wrongPassword,
  over_email_send_rate_limit: de.signIn.rateLimited,
  over_request_rate_limit: de.signIn.rateLimited,
  email_address_invalid: de.signIn.invalidEmail,
  validation_failed: de.signIn.invalidEmail,
};

function hasStringProperty<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof (value as Record<K, unknown>)[key] === 'string'
  );
}

/** Turns any error from Supabase or the network into a German message for the UI. */
export function toUserMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return de.common.networkError;
  }
  if (isAuthApiError(error)) {
    if (error.code && authErrorMessages[error.code]) {
      return authErrorMessages[error.code];
    }
    if (error.status === 429) {
      return de.signIn.rateLimited;
    }
    return de.common.genericError;
  }
  if (hasStringProperty(error, 'message')) {
    const known = databaseErrorMessages[error.message];
    if (known) {
      return known;
    }
    if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
      return de.common.networkError;
    }
  }
  return de.common.genericError;
}
