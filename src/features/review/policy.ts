/**
 * When the app may ask for a store review. The system shows the dialog at most a few times a
 * year anyway, so PUSH asks rarely and only after something good happened.
 */
export type ReviewState = {
  /** When the dialog was requested last (ISO), or null if never. */
  lastAskedAt: string | null;
  /** How often it was requested. */
  count: number;
  /** When the app was first used on this phone (ISO). */
  firstSeenAt: string;
};

export type ReviewTrigger = 'win' | 'record';

const DAY_MS = 24 * 60 * 60 * 1000;
/** No question in the first days of use. */
export const MIN_DAYS_OF_USE = 3;
/** At most one question per this many days. */
export const MIN_DAYS_BETWEEN = 90;
/** At most this many questions in the lifetime of the installation. */
export const MAX_ASKS = 3;

export function shouldAskForReview(
  state: ReviewState,
  now: Date,
  _trigger: ReviewTrigger,
): boolean {
  if (state.count >= MAX_ASKS) {
    return false;
  }
  if (now.getTime() - Date.parse(state.firstSeenAt) < MIN_DAYS_OF_USE * DAY_MS) {
    return false;
  }
  if (
    state.lastAskedAt !== null &&
    now.getTime() - Date.parse(state.lastAskedAt) < MIN_DAYS_BETWEEN * DAY_MS
  ) {
    return false;
  }
  return true;
}

export function afterAsking(state: ReviewState, now: Date): ReviewState {
  return { ...state, lastAskedAt: now.toISOString(), count: state.count + 1 };
}
