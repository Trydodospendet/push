import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

import { defaultReminderSettings, type ReminderSettings } from './plan';

const settingsSchema = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

const storageKey = (userId: string) => `push.reminders.${userId}`;

export async function loadReminderSettings(userId: string): Promise<ReminderSettings> {
  try {
    const raw = await secureStorage.getItem(storageKey(userId));
    const parsed = settingsSchema.safeParse(raw === null ? null : JSON.parse(raw));
    return parsed.success ? parsed.data : defaultReminderSettings;
  } catch {
    return defaultReminderSettings;
  }
}

export async function saveReminderSettings(
  userId: string,
  settings: ReminderSettings,
): Promise<void> {
  await secureStorage.setItem(storageKey(userId), JSON.stringify(settings));
}

/** Forgets the settings of an account on this phone (after account deletion). */
export async function clearReminderSettings(userId: string): Promise<void> {
  await secureStorage.removeItem(storageKey(userId));
}
