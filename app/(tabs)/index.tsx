import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { useMyProgress } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { pickPrimaryChallenge } from '@/features/health/progress';
import { ProgressSummary } from '@/features/health/progress-summary';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
import { de } from '@/i18n/de';
import { colors, opacity, spacing } from '@/theme';

/** The joined challenges: the most important one with its progress, the others as cards. */
export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const health = useHealth();
  const mine = useMyChallenges(session.user.id);
  const progress = useMyProgress(session.user.id);
  const joined = mine.data?.filter(
    (challenge) =>
      challenge.isParticipant && challenge.status !== 'settled' && challenge.status !== 'cancelled',
  );
  const primary = joined ? pickPrimaryChallenge(joined) : undefined;
  const lastSync = useLastSyncText(primary?.timezone ?? 'Europe/Berlin');

  if (mine.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (mine.isError) {
    return (
      <Screen>
        <ErrorState
          message={de.home.error}
          onRetry={() => mine.refetch()}
          retrying={mine.isFetching}
        />
      </Screen>
    );
  }

  if (!joined || joined.length === 0) {
    return (
      <Screen contentStyle={styles.emptyContent}>
        <Text variant="label" color="textSecondary">
          {de.home.label}
        </Text>
        <View style={styles.empty}>
          <Text variant="title" accessibilityRole="header">
            {de.home.emptyTitle}
          </Text>
          <Text color="textSecondary">{de.home.emptyText}</Text>
        </View>
        <Button label={de.home.findChallenge} onPress={() => router.navigate('/ranked')} />
      </Screen>
    );
  }

  const others = joined.filter((challenge) => challenge.id !== primary?.id);

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching || health.syncing}
          onRefresh={() => {
            void health.sync().then(() => {
              void mine.refetch();
              void progress.refetch();
            });
          }}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <HealthBanner />
      {primary ? (
        <>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.home.primaryLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primary.title}
            onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: primary.id } })}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.primary}>
              <Text variant="heading" numberOfLines={2}>
                {primary.title}
              </Text>
              <ProgressSummary
                challenge={primary}
                value={progress.data?.[primary.id] ?? 0}
                now={new Date()}
                footer={health.connected ? lastSync : null}
              />
            </Card>
          </Pressable>
        </>
      ) : null}
      {others.length > 0 ? (
        <>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.home.moreLabel}
          </Text>
          {others.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} joined />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  primary: {
    gap: spacing.md,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
