/**
 * Single source of truth for the app name (working title) and product limits.
 * Read by app.config.ts (native display name), src/i18n/de.ts (UI texts) and the validation
 * schemas. Keep this file free of imports so it can be loaded outside of React Native.
 */
export const APP_NAME = 'PUSH';

/** Must match the checks in supabase/migrations (profiles.display_name). */
export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 24;

/** Must match `otp_length` in supabase/config.toml. */
export const SIGN_IN_CODE_LENGTH = 6;
