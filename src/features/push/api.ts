import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey } from '@/features/auth/profile-query-key';
import { requestPermission } from '@/features/reminders/notifications';
import { supabase } from '@/lib/supabase';

export type PushKinds = { results: boolean; cheers: boolean; friends: boolean };

/** What the user wants to receive; the three switches live in the profile (server side). */
export function useSetPushPreferences(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kinds: PushKinds) => {
      const { error } = await supabase.rpc('set_push_preferences', {
        p_results: kinds.results,
        p_cheers: kinds.cheers,
        p_friends: kinds.friends,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

export type RegisterOutcome = 'registered' | 'denied' | 'unavailable';

/** The project id EAS needs to hand out push tokens (set in app.json after `eas init`). */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Asks for the notification permission, fetches the push token of this phone and registers it
 * for the signed-in account. Needs a build with Firebase configured (docs/PUSH.md); without it
 * the token cannot be created and the outcome is "unavailable".
 */
export async function registerThisPhone(): Promise<RegisterOutcome> {
  const permission = await requestPermission();
  if (permission !== 'granted') {
    return 'denied';
  }
  const projectId = easProjectId();
  if (!projectId) {
    return 'unavailable';
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token.data,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) {
      throw error;
    }
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

/** Removes the token of this phone from the account (switch off, or before signing out). */
export async function unregisterThisPhone(): Promise<void> {
  const projectId = easProjectId();
  if (!projectId) {
    return;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc('unregister_push_token', { p_token: token.data });
  } catch {
    // Nothing to remove if no token can be created.
  }
}

/** Where a tapped notification leads: only app-internal paths are followed. */
export function targetOfNotification(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('url' in data)) {
    return null;
  }
  const url = (data as { url: unknown }).url;
  return typeof url === 'string' && /^\/challenge\/[0-9a-f-]{36}$/.test(url) ? url : null;
}
