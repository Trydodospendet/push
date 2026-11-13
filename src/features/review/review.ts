import * as StoreReview from 'expo-store-review';
import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

import { afterAsking, shouldAskForReview, type ReviewState, type ReviewTrigger } from './policy';

const stateSchema = z.object({
  lastAskedAt: z.string().nullable(),
  count: z.number().int().min(0),
  firstSeenAt: z.string(),
});

const STORAGE_KEY = 'push.review';

async function load(now: Date): Promise<ReviewState> {
  try {
    const raw = await secureStorage.getItem(STORAGE_KEY);
    const parsed = stateSchema.safeParse(raw === null ? null : JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Unreadable: start over (the question is rare anyway).
  }
  return { lastAskedAt: null, count: 0, firstSeenAt: now.toISOString() };
}

/** Remembers the first day of use. Call once when the app starts. */
export async function noteFirstUse(now = new Date()): Promise<void> {
  try {
    const state = await load(now);
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not important enough to disturb anyone.
  }
}

/**
 * Asks for a store review (Google's in-app review on Android) if the rules allow it. Never
 * throws and never shows anything the system does not allow. Returns whether it asked.
 */
export async function maybeAskForReview(
  trigger: ReviewTrigger,
  now = new Date(),
): Promise<boolean> {
  try {
    const state = await load(now);
    if (!shouldAskForReview(state, now, trigger)) {
      return false;
    }
    if (!(await StoreReview.isAvailableAsync())) {
      return false;
    }
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(afterAsking(state, now)));
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
