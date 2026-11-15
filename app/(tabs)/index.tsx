import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, FadeIn, Icon, LoadingState, Screen, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { CompactGoal } from '@/features/challenges/compact-goal';
import { formatDistance } from '@/features/challenges/format';
import { LastGoalResult } from '@/features/challenges/last-goal-result';
import { Coach } from '@/features/coach/coach';
import { useClock } from '@/features/gps/use-clock';
import { useMyProgress } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { pickPrimaryChallenge } from '@/features/health/progress';
import { ProgressSummary } from '@/features/health/progress-summary';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
import { TodaySteps } from '@/features/health/today-card';
import { statsKeys } from '@/features/stats/api';
import { RecentWins, StreakAndWeek } from '@/features/stats/home-sections';
import { useActivePlan, useTrainingSessions } from '@/features/training/api';
import { de } from '@/i18n/de';
import { formatDayLabel, toLocalDate } from '@/lib/dates';
import { colors, highlightBorder, opacity, spacing } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const activePlan = useActivePlan(user.id);
  const training = useTrainingSessions(user.id, activePlan.data);
  const health = useHealth();
  const mine = useMyChallenges(user.id);
  const progress = useMyProgress(user.id);
  const [showStats, setShowStats] = useState(false);
  const clock = useClock(true);
  const now = new Date(clock);
  const joined = (mine.data ?? []).filter(
    (goal) =>
      goal.isParticipant &&
      goal.status !== 'settled' &&
      goal.status !== 'cancelled' &&
      Date.parse(goal.ends_at) > clock,
  );
  const primary = pickPrimaryChallenge(joined);
  const timezone = primary?.timezone ?? DEFAULT_TIMEZONE;
  const lastSync = useLastSyncText(timezone);
  const nextSession = training.sessions?.find(
    (session) => !session.done && session.date >= toLocalDate(now, DEFAULT_TIMEZONE),
  );
  const others = joined.filter((goal) => goal.id !== primary?.id);

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
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.home.label}
        </Text>
        <Text color="textSecondary">{formatDayLabel(toLocalDate(now, timezone))}</Text>
      </View>

      {mine.isPending ? (
        <LoadingState />
      ) : mine.isError && !mine.data ? (
        <ErrorState
          message={de.home.error}
          onRetry={() => mine.refetch()}
          retrying={mine.isFetching}
        />
      ) : primary ? (
        <View style={styles.group}>
          <Text variant="label" color="accent" accessibilityRole="header">
            {de.home.primaryLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primary.title}
            accessibilityHint={de.home.goalDetails}
            onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: primary.id } })}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={[styles.feature, styles.group]}>
              <View style={styles.row}>
                <Text variant="heading" style={styles.goalTitle}>
                  {primary.title}
                </Text>
                <Icon name="chevron-forward" color="accent" />
              </View>
              {progress.data ? (
                <ProgressSummary
                  challenge={primary}
                  value={progress.data[primary.id] ?? 0}
                  now={now}
                  footer={health.connected ? lastSync : null}
                  ring
                />
              ) : progress.isError ? (
                <Text color="textSecondary">{de.home.goalsUnavailable}</Text>
              ) : (
                <LoadingState />
              )}
            </Card>
          </Pressable>
          <Button
            label={de.home.setGoal}
            variant="secondary"
            onPress={() => router.push('/challenge/create')}
          />
        </View>
      ) : (
        <Card style={[styles.feature, styles.group]}>
          <Icon name="flag-outline" color="accent" />
          <Text variant="heading">{de.home.emptyTitle}</Text>
          <Text color="textSecondary">{de.home.emptyText}</Text>
          <Button label={de.home.setGoal} onPress={() => router.push('/challenge/create')} />
        </Card>
      )}

      {others.length ? (
        <View style={styles.group}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.home.moreLabel}
          </Text>
          {others.map((goal) => (
            <CompactGoal
              key={goal.id}
              challenge={goal}
              value={progress.data?.[goal.id] ?? null}
              now={now}
            />
          ))}
        </View>
      ) : null}

      <Card style={styles.group}>
        <View style={styles.row}>
          <Icon name="footsteps-outline" color="accent" />
          <Text variant="heading" style={styles.goalTitle}>
            {de.home.planTitle}
          </Text>
        </View>
        {activePlan.data ? <Text>{de.training.plans[activePlan.data.planId].name}</Text> : null}
        {nextSession ? (
          <Text color="textSecondary">
            {formatDayLabel(nextSession.date)} · {formatDistance(nextSession.distanceM)}
          </Text>
        ) : null}
        <Button
          label={de.home.run}
          onPress={() => router.push('/run/index')}
          variant={primary ? 'primary' : 'secondary'}
        />
        <Button
          label={activePlan.data ? de.training.homeButton : de.home.startPlan}
          variant="secondary"
          onPress={() => router.push('/training')}
        />
      </Card>

      <TodaySteps
        target={primary?.goal_type === 'steps_daily' ? primary.target_value : undefined}
      />
      <HealthBanner />
      <Coach />
      <LastGoalResult />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showStats }}
        onPress={() => setShowStats(!showStats)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card style={styles.row}>
          <Text style={styles.goalTitle}>{de.home.extra}</Text>
          <Icon name={showStats ? 'chevron-up' : 'chevron-down'} color="textSecondary" />
        </Card>
      </Pressable>
      {showStats ? (
        <FadeIn style={styles.group} durationMs={220} rise={8}>
          <StreakAndWeek userId={user.id} />
          <RecentWins userId={user.id} timezone={timezone} />
        </FadeIn>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  header: { gap: spacing.xxs },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalTitle: { flex: 1 },
  feature: { backgroundColor: colors.surfaceRaised, borderColor: highlightBorder },
  pressed: { opacity: opacity.pressed },
});
