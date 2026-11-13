import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

/**
 * Settings of this phone (not of an account): animations and haptic feedback can be switched
 * off. They are kept outside React so that any code can read them, e.g. the haptics helper.
 */
const preferencesSchema = z.object({
  animations: z.boolean(),
  haptics: z.boolean(),
  /** Spoken kilometre announcements while running (off until the runner switches it on). */
  voice: z.boolean().default(false),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const defaultPreferences: Preferences = {
  animations: true,
  haptics: true,
  voice: false,
};

const STORAGE_KEY = 'push.preferences';

let current: Preferences = defaultPreferences;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getPreferences(): Preferences {
  return current;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reads the stored settings once (app start). Unreadable values fall back to the defaults. */
export async function loadPreferences(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const raw = await secureStorage.getItem(STORAGE_KEY);
    const parsed = preferencesSchema.safeParse(raw === null ? null : JSON.parse(raw));
    if (parsed.success) {
      current = parsed.data;
      emit();
    }
  } catch {
    current = defaultPreferences;
  }
}

export async function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): Promise<void> {
  current = { ...current, [key]: value };
  emit();
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // The setting still applies until the app is closed.
  }
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getPreferences);
}

/** For tests: back to the defaults, as if the app had just started. */
export function resetPreferences(): void {
  current = defaultPreferences;
  loaded = false;
  emit();
}
