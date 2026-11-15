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
import { LogoEgg } from '@/features/badges/logo-egg';
import { StatsCard } from '@/features/stats/stats-card';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { colors, highlightBorder, spacing } from '@/theme';

type Target =
  | '/wallet'
  | '/pool'
  | '/settings/account'
  | '/settings/privacy'
  | '/settings/notifications'
  | '/settings/donations'
  | '/settings/connections'
  | '/settings/appearance'
  | '/settings/data'
  | '/help';

const GROUPS: readonly {
  section: keyof typeof de.profile.sections;
  target: Target;
  icon: Parameters<typeof SettingsRow>[0]['icon'];
  text: { label: string; detail: string };
}[] = [
  {
    section: 'credits',
    target: '/wallet',
    icon: 'wallet-outline',
    text: { label: de.improvements.wallet, detail: de.common.virtualCreditsNotice },
  },
  {
    section: 'credits',
    target: '/pool',
    icon: 'flag-outline',
    text: { label: de.improvements.pool, detail: de.profile.poolDetail },
  },
  {
    section: 'account',
    target: '/settings/account',
    icon: 'person-circle-outline',
    text: de.settings.account,
  },
  {
    section: 'account',
    target: '/settings/privacy',
    icon: 'eye-off-outline',
    text: de.settings.privacy,
  },
  {
    section: 'app',
    target: '/settings/notifications',
    icon: 'notifications-outline',
    text: de.settings.notifications,
  },
  {
    section: 'credits',
    target: '/settings/donations',
    icon: 'heart-outline',
    text: de.settings.donations,
  },
  {
    section: 'app',
    target: '/settings/connections',
    icon: 'pulse-outline',
    text: de.settings.connections,
  },
  {
    section: 'app',
    target: '/settings/appearance',
    icon: 'color-wand-outline',
    text: de.settings.appearance,
  },
  {
    section: 'account',
    target: '/settings/data',
    icon: 'shield-checkmark-outline',
    text: de.settings.data,
  },
  { section: 'support', target: '/help', icon: 'help-buoy-outline', text: de.settings.help },
];

/** Overview: who I am, my numbers and badges, and the groups of settings. */
export default function ProfileScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const signOut = useSignOut();
  const avatar = useAvatarUrl(profile.data?.avatar_path);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">
        {de.tabs.profile}
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
          <Card style={styles.identity}>
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
          </Card>
          <StatsCard userId={session.user.id} />
          <BadgesCard userId={session.user.id} />
        </View>
      )}

      {Object.entries(de.profile.sections).map(([section, label]) => (
        <View key={section} style={styles.group}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {label}
          </Text>
          {GROUPS.filter((group) => group.section === section).map((group) => (
            <SettingsRow
              key={group.target}
              icon={group.icon}
              label={group.text.label}
              detail={group.text.detail}
              onPress={() => router.push(group.target)}
            />
          ))}
          {section === 'support' ? (
            <SettingsRow
              icon="help-circle-outline"
              label={de.profile.howItWorks}
              onPress={() => router.push('/how-it-works')}
            />
          ) : null}
        </View>
      ))}
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
      <LogoEgg />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  details: {
    gap: spacing.md,
  },
  identity: {
    backgroundColor: colors.surfaceRaised,
    borderColor: highlightBorder,
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
