import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { CompactGoal } from '@/features/challenges/compact-goal';
import { LastGoalResult } from '@/features/challenges/last-goal-result';
import { TodaySteps } from '@/features/health/today-card';
import { useClock } from '@/features/gps/use-clock';
import { useMyProgress } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { pickPrimaryChallenge } from '@/features/health/progress';
import { ProgressSummary } from '@/features/health/progress-summary';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
import { RecentWins, StreakAndWeek } from '@/features/stats/home-sections';
import { statsKeys } from '@/features/stats/api';
import { useActivePlan } from '@/features/training/api';
import { de } from '@/i18n/de';
import { colors, opacity, spacing } from '@/theme';

/**
 * Home: the one thing to do is "Ziel setzen". The most important running goal is shown big,
 * further goals in a small overview.
 */
export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const activePlan = useActivePlan(session.user.id);
  const health = useHealth();
  const mine = useMyChallenges(session.user.id);
  const progress = useMyProgress(session.user.id);
  const clock = useClock(true);
  const joined = mine.data?.filter(
    (challenge) =>
      challenge.isParticipant &&
      challenge.status !== 'settled' &&
      challenge.status !== 'cancelled' &&
      Date.parse(challenge.ends_at) > clock,
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

  const trainingCard = activePlan.data ? (
    <Card>
      <Text variant="heading">{de.training.plans[activePlan.data.planId].name}</Text>
      <Button label={de.training.homeButton} onPress={() => router.push('/training')} />
    </Card>
  ) : null;
  const setGoal = (
    <Button label={de.home.setGoal} onPress={() => router.push('/challenge/create')} />
  );

  if (!joined || joined.length === 0) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <Text variant="label" color="textSecondary">
          {de.home.label}
        </Text>
        <Card style={styles.how}>
          <Text variant="title">{mine.data.length ? de.coach.nextGoal : de.home.emptyTitle}</Text>
          <Text color="textSecondary">{de.home.emptyText}</Text>
          {setGoal}
        </Card>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.home.howLabel}
        </Text>
        <Card style={styles.how}>
          {de.home.howSteps.map((step, index) => (
            <Text key={step} color="textSecondary">{`${index + 1}. ${step}`}</Text>
          ))}
        </Card>
        <LastGoalResult />
        <TodaySteps />
        <HealthBanner />
        <StreakAndWeek userId={session.user.id} />
        {trainingCard}
        <RecentWins userId={session.user.id} timezone={timezone} />
      </Screen>
    );
  }

  const others = joined.filter((challenge) => challenge.id !== primary?.id);
  const now = new Date();

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
      <Text variant="title">{de.home.label}</Text>
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
                now={now}
                footer={health.connected ? lastSync : null}
                ring
              />
            </Card>
          </Pressable>
        </>
      ) : null}
      {setGoal}
      <TodaySteps
        target={primary?.goal_type === 'steps_daily' ? primary.target_value : undefined}
      />
      {others.length > 0 ? (
        <View style={styles.others}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.home.moreLabel}
          </Text>
          {others.map((challenge) => (
            <CompactGoal
              key={challenge.id}
              challenge={challenge}
              value={progress.data?.[challenge.id] ?? 0}
              now={now}
            />
          ))}
        </View>
      ) : null}
      <LastGoalResult />
      <StreakAndWeek userId={session.user.id} />
      {trainingCard}
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
  how: {
    gap: spacing.sm,
  },
  others: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
