/**
 * Single source of truth for the app name (working title), product limits and presets.
 * Read by app.config.ts (native display name), src/i18n/de.ts (UI texts) and the validation
 * schemas. Keep this file free of imports so it can be loaded outside of React Native.
 *
 * Limits marked "DB" must match supabase/migrations.
 */
export const APP_NAME = 'PUSH';

/** DB: profiles.display_name */
export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 24;

/** Must match `otp_length` in supabase/config.toml. */
export const SIGN_IN_CODE_LENGTH = 6;

/** Timezone of new profiles and challenges (DB default). */
export const DEFAULT_TIMEZONE = 'Europe/Berlin';

export const GOAL_TYPES = ['run_single', 'run_total', 'steps_daily'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** DB: challenges.title */
export const CHALLENGE_TITLE_MIN_LENGTH = 3;
export const CHALLENGE_TITLE_MAX_LENGTH = 60;

/** DB: target_value per goal type (metres for runs, steps per day). */
export const TARGET_LIMITS: Record<GoalType, { min: number; max: number }> = {
  run_single: { min: 1_000, max: 100_000 },
  run_total: { min: 1_000, max: 500_000 },
  steps_daily: { min: 1_000, max: 50_000 },
};

export const TARGET_PRESETS: Record<GoalType, readonly number[]> = {
  run_single: [3_000, 5_000, 10_000, 21_100],
  run_total: [3_000, 5_000, 10_000, 21_100],
  steps_daily: [8_000, 10_000, 12_000],
};

/** DB: challenges.stake_cents (1,00 to 50,00 credits). */
export const STAKE_MIN_CENTS = 100;
export const STAKE_MAX_CENTS = 5_000;
export const STAKE_PRESETS_CENTS = [100, 500, 1_000, 2_000] as const;

/** DB: create_challenge – start date from tomorrow up to 30 days ahead, 1 to 42 days long. */
export const START_MIN_DAYS_AHEAD = 1;
export const START_MAX_DAYS_AHEAD = 30;
export const START_PRESET_DAYS_AHEAD = [1, 2, 3, 4, 5, 6, 7] as const;
export const DURATION_MIN_DAYS = 1;
export const DURATION_MAX_DAYS = 42;
export const DURATION_PRESETS_DAYS = [1, 3, 7, 14, 28, 42] as const;

/** DB: challenges.invite_code */
export const INVITE_CODE_LENGTH = 6;
