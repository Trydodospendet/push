import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

import type { Win } from './api';

/**
 * Which wins this phone already celebrated. `since` is when the app first looked: wins that
 * were settled before that are history and never celebrated afterwards.
 */
const celebrationSchema = z.object({
  since: z.string(),
  seen: z.array(z.string()),
});

export type CelebrationState = z.infer<typeof celebrationSchema>;

/** Remember at most this many ids; older wins are far behind `since` anyway. */
const MAX_SEEN = 100;

const storageKey = (userId: string) => `push.celebrated.${userId}`;

export async function loadCelebrationState(userId: string, now: Date): Promise<CelebrationState> {
  try {
    const raw = await secureStorage.getItem(storageKey(userId));
    const parsed = celebrationSchema.safeParse(raw === null ? null : JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Unreadable value: start fresh below.
  }
  const fresh: CelebrationState = { since: now.toISOString(), seen: [] };
  await saveCelebrationState(userId, fresh).catch(() => undefined);
  return fresh;
}

export async function saveCelebrationState(
  userId: string,
  state: CelebrationState,
): Promise<void> {
  await secureStorage.setItem(
    storageKey(userId),
    JSON.stringify({ ...state, seen: state.seen.slice(-MAX_SEEN) }),
  );
}

export async function clearCelebrationState(userId: string): Promise<void> {
  await secureStorage.removeItem(storageKey(userId));
}

/** The oldest win that was settled after `since` and not shown yet, or undefined. */
export function nextUnseenWin(wins: Win[], state: CelebrationState): Win | undefined {
  const since = Date.parse(state.since);
  return wins
    .filter((win) => !state.seen.includes(win.challengeId) && Date.parse(win.settledAt) > since)
    .sort((a, b) => Date.parse(a.settledAt) - Date.parse(b.settledAt))[0];
}
