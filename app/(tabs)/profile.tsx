import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useMyProfile, useSignOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { toUserMessage } from '@/lib/errors';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

/** Phase 1: name, email and sign-out. Settings and account deletion follow later. */
export default function ProfileScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const signOut = useSignOut();

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
      </View>
    </Screen>
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
