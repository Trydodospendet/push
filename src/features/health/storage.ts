import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

/**
 * What this phone knows about the health connection of one account. Kept on the device
 * (not on the server) because permissions belong to the device, not to the account.
 */
const healthStateSchema = z.object({
  /** The explanation screen was answered (connected or skipped). */
  introDone: z.boolean(),
  connected: z.boolean(),
  /** Android only exposes the 30 days before the first authorization. */
  firstAuthorizedAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
});

export type HealthState = z.infer<typeof healthStateSchema>;

export const initialHealthState: HealthState = {
  introDone: false,
  connected: false,
  firstAuthorizedAt: null,
  lastSyncAt: null,
};

const storageKey = (userId: string) => `push.health.${userId}`;

export async function loadHealthState(userId: string): Promise<HealthState> {
  try {
    const raw = await secureStorage.getItem(storageKey(userId));
    const parsed = healthStateSchema.safeParse(raw === null ? null : JSON.parse(raw));
    return parsed.success ? parsed.data : initialHealthState;
  } catch {
    // Unreadable or damaged value: ask again instead of blocking the app.
    return initialHealthState;
  }
}

/** Forgets the connection state of an account on this phone (after account deletion). */
export async function clearHealthState(userId: string): Promise<void> {
  await secureStorage.removeItem(storageKey(userId));
}

export async function saveHealthState(userId: string, state: HealthState): Promise<void> {
  await secureStorage.setItem(storageKey(userId), JSON.stringify(state));
}
