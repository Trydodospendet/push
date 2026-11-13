import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet } from 'react-native';

import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { useMyProgress } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { pickPrimaryChallenge } from '@/features/health/progress';
import { ProgressSummary } from '@/features/health/progress-summary';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
import { RecentWins, StreakAndWeek } from '@/features/stats/home-sections';
import { statsKeys } from '@/features/stats/api';
import { de } from '@/i18n/de';
import { colors, opacity, spacing } from '@/theme';

/** The joined challenges: the most important one with its progress, the others as cards. */
export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const health = useHealth();
  const mine = useMyChallenges(session.user.id);
  const progress = useMyProgress(session.user.id);
  const joined = mine.data?.filter(
    (challenge) =>
      challenge.isParticipant && challenge.status !== 'settled' && challenge.status !== 'cancelled',
  );
  const primary = joined ? pickPrimaryChallenge(joined) : undefined;
  const timezone = primary?.timezone ?? DEFAULT_TIMEZONE;
  const lastSync = useLastSyncText(timezone);

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
      <Screen scroll contentStyle={styles.content}>
        <Text variant="label" color="textSecondary">
          {de.home.label}
        </Text>
        <EmptyState
          icon="flag-outline"
          title={de.home.emptyTitle}
          text={de.home.emptyText}
          actionLabel={de.home.findChallenge}
          onAction={() => router.navigate('/ranked')}
        />
        <Button
          label={de.social.homeButton}
          variant="secondary"
          onPress={() => router.push('/social')}
        />
        <Button
          label={de.run.homeButton}
          variant="secondary"
          onPress={() => router.push('/run/index')}
        />
        <StreakAndWeek userId={session.user.id} />
        <RecentWins userId={session.user.id} timezone={timezone} />
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
              void queryClient.invalidateQueries({ queryKey: statsKeys.all });
            });
          }}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <HealthBanner />
      <Button
        label={de.social.homeButton}
        variant="secondary"
        onPress={() => router.push('/social')}
      />
      <Button
        label={de.run.homeButton}
        variant="secondary"
        onPress={() => router.push('/run/index')}
      />
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
                ring
              />
            </Card>
          </Pressable>
        </>
      ) : null}
      <StreakAndWeek userId={session.user.id} />
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
      <RecentWins userId={session.user.id} timezone={timezone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  primary: {
    gap: spacing.md,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
