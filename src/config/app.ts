/**
 * Single source of truth for the app name (working title), product limits and presets.
 * Read by app.config.ts (native display name), src/i18n/de.ts (UI texts) and the validation
 * schemas. Keep this file free of imports so it can be loaded outside of React Native.
 *
 * Limits marked "DB" must match supabase/migrations.
 */
export const APP_NAME = 'PUSH';

/**
 * Operator details for privacy policy and imprint. Empty strings (phone, register, vatId) are
 * left out of the imprint. The web versions in
 * docs/legal/*.html contain the same placeholders and must be updated together.
 */
export const LEGAL = {
  operatorName: 'Darab Baryalai',
  street: 'Babenhäuser Straße 5',
  city: '63533 Mainhausen',
  country: 'Deutschland',
  email: 'kontakt@puschdich.de',
  phone: '',
  register: '',
  vatId: '',
  supabaseRegion: 'EU – Frankfurt (eu-central-1)',
  emailProvider: 'Resend (Resend, Inc.), Versand über Server in der EU (Irland)',
  updatedAt: '13.11.2026',
  /** Public web page with deletion instructions (docs/legal/delete-account.html, hosted). */
  deletionUrl: 'https://puschdich.netlify.app/delete-account.html',
} as const;

/** DB: profiles.display_name */
export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 24;

/** Must match `otp_length` in supabase/config.toml. */
export const SIGN_IN_CODE_LENGTH = 6;

/** Timezone of new profiles and challenges (DB default). */
export const DEFAULT_TIMEZONE = 'Europe/Berlin';

/**
 * DB: challenges.mode – ranked (pure leaderboard, no stake) or pool (everybody pays a stake into
 * one pot; those who reach the goal share the stakes of those who do not).
 */
export const CHALLENGE_MODES = ['ranked', 'pool', 'goal'] as const;
export type ChallengeMode = (typeof CHALLENGE_MODES)[number];

export const GOAL_TYPES = ['run_single', 'run_total', 'steps_daily', 'steps_total'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** DB: challenges.title */
export const CHALLENGE_TITLE_MIN_LENGTH = 3;
export const CHALLENGE_TITLE_MAX_LENGTH = 60;

/** DB: target_value per goal type (metres for runs, steps per day). */
export const TARGET_LIMITS: Record<GoalType, { min: number; max: number }> = {
  run_single: { min: 1_000, max: 100_000 },
  run_total: { min: 1_000, max: 500_000 },
  steps_daily: { min: 1_000, max: 50_000 },
  steps_total: { min: 5_000, max: 2_000_000 },
};

export const TARGET_PRESETS: Record<GoalType, readonly number[]> = {
  run_single: [3_000, 5_000, 10_000, 21_100],
  run_total: [3_000, 5_000, 10_000, 21_100],
  steps_daily: [8_000, 10_000, 12_000],
  steps_total: [30_000, 70_000, 100_000, 150_000],
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

/**
 * DB: create_goal – the period of a personal goal: today, the coming week (Monday to Sunday)
 * or the coming calendar month. All goals with the same period share one pot.
 */
export const GOAL_PERIODS = ['day', 'week', 'month'] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

/** DB: challenges.invite_code */
export const INVITE_CODE_LENGTH = 6;

/**
 * Map style of the GPS run screens: OpenFreeMap (free, no API key), dark variant. Tiles are
 * requested from tiles.openfreemap.org – mentioned in the privacy policy.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/fiord';
