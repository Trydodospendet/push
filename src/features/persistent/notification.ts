import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { de } from '@/i18n/de';

const CHANNEL_ID = 'progress';
const IDENTIFIER = 'persistent-progress';

/** Only Android has permanent notifications; on iOS the setting does nothing. */
export const persistentSupported = Platform.OS === 'android';

/** Shows (or replaces) the quiet, permanent progress notification. */
export async function showProgress(text: string): Promise<void> {
  if (!persistentSupported) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: de.persistent.channelName,
    importance: AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    showBadge: false,
  });
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: de.persistent.title,
      body: text,
      sticky: true,
      autoDismiss: false,
      sound: false,
    },
    trigger: { channelId: CHANNEL_ID },
  });
}

export async function clearProgress(): Promise<void> {
  if (!persistentSupported) return;
  await Notifications.dismissNotificationAsync(IDENTIFIER);
}
