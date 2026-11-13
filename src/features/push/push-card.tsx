import { useEffect, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Button, Card, SwitchRow, Text } from '@/components';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { de } from '@/i18n/de';
import { secureStorage } from '@/lib/secure-storage';
import { spacing } from '@/theme';

import { registerThisPhone, unregisterThisPhone, useSetPushPreferences } from './api';

const storageKey = (userId: string) => `push.enabled.${userId}`;

/** Messages from the server (result, cheers, friend requests); each kind can be switched off. */
export function PushCard() {
  const session = useSession();
  const userId = session.user.id;
  const profile = useMyProfile(userId);
  const save = useSetPushPreferences(userId);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'denied' | 'unavailable' | null>(null);

  useEffect(() => {
    let active = true;
    void secureStorage
      .getItem(storageKey(userId))
      .then((value) => {
        if (active) {
          setEnabled(value === '1');
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = (next: boolean) => {
    setBusy(true);
    setMessage(null);
    const task = next
      ? registerThisPhone().then(async (outcome) => {
          if (outcome === 'registered') {
            await secureStorage.setItem(storageKey(userId), '1');
            setEnabled(true);
          } else {
            setMessage(outcome);
          }
        })
      : unregisterThisPhone().then(async () => {
          await secureStorage.removeItem(storageKey(userId));
          setEnabled(false);
        });
    void task.catch(() => setMessage('unavailable')).finally(() => setBusy(false));
  };

  const kinds = {
    results: profile.data?.push_results ?? true,
    cheers: profile.data?.push_cheers ?? true,
    friends: profile.data?.push_friends ?? true,
  };

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.push.label}
      </Text>
      <SwitchRow
        label={de.push.toggle}
        hint={de.push.toggleHint}
        value={enabled}
        disabled={busy}
        onChange={toggle}
      />
      {message === 'denied' ? (
        <>
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {de.reminders.deniedHint}
          </Text>
          <Button
            label={de.reminders.openSettings}
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        </>
      ) : null}
      {message === 'unavailable' ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {de.push.unavailable}
        </Text>
      ) : null}
      {enabled ? (
        <>
          <SwitchRow
            label={de.push.results}
            value={kinds.results}
            disabled={save.isPending}
            onChange={(value) => save.mutate({ ...kinds, results: value })}
          />
          <SwitchRow
            label={de.push.cheers}
            value={kinds.cheers}
            disabled={save.isPending}
            onChange={(value) => save.mutate({ ...kinds, cheers: value })}
          />
          <SwitchRow
            label={de.push.friends}
            value={kinds.friends}
            disabled={save.isPending}
            onChange={(value) => save.mutate({ ...kinds, friends: value })}
          />
        </>
      ) : null}
      <Text variant="caption" color="textMuted">
        {de.push.privacy}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
});
