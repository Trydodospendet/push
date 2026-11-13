import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { de } from '@/i18n/de';

import type { PlannedReminder } from './plan';

const CHANNEL_ID = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Shows reminders as banners also while the app is open. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs the channel before the system asks for the Android 13 permission. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: de.reminders.channelName,
      importance: AndroidImportance.DEFAULT,
    });
  }
}

function toState(status: Notifications.PermissionStatus): PermissionState {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export async function getPermissionState(): Promise<PermissionState> {
  const result = await Notifications.getPermissionsAsync();
  return toState(result.status);
}

/** Asks for the permission. Resolves to the state afterwards; never asks twice if denied for good. */
export async function requestPermission(): Promise<PermissionState> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) {
    return 'granted';
  }
  if (!current.canAskAgain) {
    return 'denied';
  }
  const result = await Notifications.requestPermissionsAsync();
  return toState(result.status);
}

/** Replaces all scheduled reminders with the given plan. */
export async function applyPlan(plan: readonly PlannedReminder[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await ensureChannel();
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.key,
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: CHANNEL_ID,
      },
    });
  }
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** A local delivery check, independent of Firebase and server configuration. */
export async function sendTestNotification(): Promise<boolean> {
  if ((await requestPermission()) !== 'granted') return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: de.coach.hello, body: de.coach.ongoing },
    trigger: null,
  });
  return true;
}
