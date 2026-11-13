import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  SettingsRow,
  Text,
} from '@/components';
import { useAvatarUrl } from '@/features/account/api';
import { useMyProfile, useSignOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { BadgesCard } from '@/features/badges/badges-card';
import { StatsCard } from '@/features/stats/stats-card';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

type Target =
  | '/settings/account'
  | '/settings/privacy'
  | '/settings/notifications'
  | '/settings/donations'
  | '/settings/connections'
  | '/settings/appearance'
  | '/settings/data';

const GROUPS: readonly {
  target: Target;
  icon: Parameters<typeof SettingsRow>[0]['icon'];
  text: { label: string; detail: string };
}[] = [
  { target: '/settings/account', icon: 'person-circle-outline', text: de.settings.account },
  { target: '/settings/privacy', icon: 'eye-off-outline', text: de.settings.privacy },
  {
    target: '/settings/notifications',
    icon: 'notifications-outline',
    text: de.settings.notifications,
  },
  { target: '/settings/donations', icon: 'heart-outline', text: de.settings.donations },
  { target: '/settings/connections', icon: 'pulse-outline', text: de.settings.connections },
  { target: '/settings/appearance', icon: 'color-wand-outline', text: de.settings.appearance },
  { target: '/settings/data', icon: 'shield-checkmark-outline', text: de.settings.data },
];

/** Overview: who I am, my numbers and badges, and the groups of settings. */
export default function ProfileScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const signOut = useSignOut();
  const avatar = useAvatarUrl(profile.data?.avatar_path);

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
          <View style={styles.identity}>
            <Avatar
              name={profile.data.display_name}
              size="lg"
              highlight
              uri={avatar.data ?? null}
            />
            <View style={styles.name}>
              <Text variant="title" accessibilityRole="header" numberOfLines={2}>
                {profile.data.display_name}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {session.user.email}
              </Text>
            </View>
          </View>
          <StatsCard userId={session.user.id} />
          <BadgesCard userId={session.user.id} />
        </View>
      )}

      <View style={styles.group}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.settings.title}
        </Text>
        {GROUPS.map((group) => (
          <SettingsRow
            key={group.target}
            icon={group.icon}
            label={group.text.label}
            detail={group.text.detail}
            onPress={() => router.push(group.target)}
          />
        ))}
        <SettingsRow
          icon="help-circle-outline"
          label={de.profile.howItWorks}
          onPress={() => router.push('/how-it-works')}
        />
      </View>

      <Card style={styles.footer}>
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
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  details: {
    gap: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    flex: 1,
  },
  group: {
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
  },
});
