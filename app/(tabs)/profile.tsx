import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Sheet, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useDeleteAccount, useMyProfile, useSignOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useHealth } from '@/features/health/health-provider';
import { healthSourceName } from '@/features/health/platform';
import { useLastSyncText } from '@/features/health/sync-status';
import { toUserMessage } from '@/lib/errors';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

/** Name, email, health connection, legal pages, sign-out and account deletion. */
export default function ProfileScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const signOut = useSignOut();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text variant="label" color="textSecondary">
        {de.profile.label}
      </Text>
      {profile.isPending ? (
        <LoadingState />
      ) : profile.isError ? (
        <ErrorState
          message={de.profile.error}
          onRetry={() => profile.refetch()}
          retrying={profile.isFetching}
        />
      ) : (
        <View style={styles.details}>
          <Text variant="title" accessibilityRole="header">
            {profile.data.display_name}
          </Text>
          <Card style={styles.card}>
            <Text variant="label" color="textSecondary">
              {de.profile.emailLabel}
            </Text>
            <Text>{session.user.email}</Text>
          </Card>
        </View>
      )}
      <HealthCard timezone={profile.data?.timezone ?? DEFAULT_TIMEZONE} />
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.profile.legalLabel}
        </Text>
        <Button
          label={de.profile.privacy}
          variant="secondary"
          onPress={() => router.push('/legal/privacy')}
        />
        <Button
          label={de.profile.imprint}
          variant="secondary"
          onPress={() => router.push('/legal/imprint')}
        />
      </Card>
      <View style={styles.footer}>
        {signOut.isError ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {toUserMessage(signOut.error) === de.common.networkError
              ? de.profile.signOutError
              : toUserMessage(signOut.error)}
          </Text>
        ) : null}
        <Button
          label={de.profile.signOut}
          variant="secondary"
          onPress={() => signOut.mutate()}
          loading={signOut.isPending}
        />
        <Button
          label={de.profile.deleteAccount}
          variant="danger"
          onPress={() => setDeleteOpen(true)}
        />
      </View>
      <DeleteAccountSheet
        userId={session.user.id}
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}

function DeleteAccountSheet({
  userId,
  visible,
  onClose,
}: {
  userId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const deleteAccount = useDeleteAccount(userId);
  const close = () => {
    if (!deleteAccount.isPending) {
      deleteAccount.reset();
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      title={de.deleteAccount.title}
      onClose={close}
      closeLabel={de.deleteAccount.cancel}
    >
      <Text color="danger">{de.deleteAccount.intro}</Text>
      {de.deleteAccount.points.map((point) => (
        <Text key={point} variant="caption" color="textSecondary">
          {`• ${point}`}
        </Text>
      ))}
      <Text variant="caption" color="textSecondary">
        {de.deleteAccount.healthHint(healthSourceName)}
      </Text>
      <Text variant="caption" color="textMuted">
        {de.common.virtualCreditsNotice}
      </Text>
      {deleteAccount.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {toUserMessage(deleteAccount.error) === de.common.networkError
            ? de.deleteAccount.networkError
            : toUserMessage(deleteAccount.error)}
        </Text>
      ) : null}
      <Button
        label={de.deleteAccount.confirm}
        variant="danger"
        loading={deleteAccount.isPending}
        onPress={() => deleteAccount.mutate()}
      />
      <Button
        label={de.deleteAccount.cancel}
        variant="secondary"
        disabled={deleteAccount.isPending}
        onPress={close}
      />
    </Sheet>
  );
}

function HealthCard({ timezone }: { timezone: string }) {
  const health = useHealth();
  const lastSync = useLastSyncText(timezone);
  const [connecting, setConnecting] = useState(false);

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.health.statusLabel}
      </Text>
      <Text>
        {health.connected
          ? de.health.connected(healthSourceName)
          : de.health.notConnected(healthSourceName)}
      </Text>
      {health.connected ? (
        <Text variant="caption" color="textMuted">
          {lastSync}
        </Text>
      ) : null}
      {health.error !== null ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {health.error}
        </Text>
      ) : null}
      {health.connected ? (
        <Button
          label={de.health.syncNow}
          variant="secondary"
          loading={health.syncing}
          onPress={() => void health.sync()}
        />
      ) : null}
      <Button
        label={health.connected ? de.health.reconnect : de.health.connect(healthSourceName)}
        variant="secondary"
        loading={connecting}
        onPress={() => {
          setConnecting(true);
          void health.connect().finally(() => setConnecting(false));
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  details: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.xxs,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
