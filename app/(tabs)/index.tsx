import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { SleepyPushy } from '@/features/coach/sleepy-pushy';
import { CommunityCounter } from '@/features/donations/donation-cards';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { CompactGoal } from '@/features/challenges/compact-goal';
import { formatDistance } from '@/features/challenges/format';
import { HeroGoal } from '@/features/challenges/hero-goal';
import { LastGoalResult } from '@/features/challenges/last-goal-result';
import { CommunityCard } from '@/features/community/community-card';
import { useClock } from '@/features/gps/use-clock';
import { useMyProgress } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { pickPrimaryChallenge } from '@/features/health/progress';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
import { TodaySteps } from '@/features/health/today-card';
import { hapticSelect } from '@/features/preferences/haptics';
import { QuickGoalCards } from '@/features/pledge/quick-goal-cards';
import { statsKeys } from '@/features/stats/api';
import { RecentWins, WeekSummary } from '@/features/stats/home-sections';
import { StreakFlame } from '@/features/stats/streak-flame';
import { useActivePlan, useTrainingSessions } from '@/features/training/api';
import { de } from '@/i18n/de';
import { formatDayLabel, toLocalDate } from '@/lib/dates';
import { colors, layout, spacing } from '@/theme';

/**
 * Home in seconds: one active goal big (ring, one button, streak) or three suggestions to pick
 * from. Everything else sits folded under "Mehr".
 */
export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const activePlan = useActivePlan(session.user.id);
  const training = useTrainingSessions(session.user.id, activePlan.data);
  const health = useHealth();
  const mine = useMyChallenges(session.user.id);
  const progress = useMyProgress(session.user.id);
  const clock = useClock(true);
  const now = new Date(clock);
  const [more, setMore] = useState(false);
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

  const nextRun = training.sessions?.find(
    (item) => !item.done && item.date >= toLocalDate(now, DEFAULT_TIMEZONE),
  );
  const others = (joined ?? []).filter((challenge) => challenge.id !== primary?.id);
  const isRun = primary?.goal_type.startsWith('run') ?? false;

  const refresh = () => {
    void health.sync().then(() => {
      void mine.refetch();
      void progress.refetch();
      void queryClient.invalidateQueries({ queryKey: statsKeys.all });
    });
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching || health.syncing}
          onRefresh={refresh}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      {primary ? null : (
        <View style={styles.idle}>
          <Text variant="label" color="textSecondary">
            {`${de.home.label} · ${de.home.ready}`}
          </Text>
          <SleepyPushy pose="sit" height={168} />
        </View>
      )}
      <HealthBanner />
      {primary ? (
        progress.data ? (
          <HeroGoal
            challenge={primary}
            value={progress.data[primary.id] ?? 0}
            now={now}
            mainLabel={isRun ? de.home.run : de.home.refreshSteps}
            mainLoading={!isRun && health.syncing}
            onMainAction={isRun ? () => router.push('/run') : refresh}
          />
        ) : progress.isError ? (
          <Text color="textSecondary">{de.home.goalsUnavailable}</Text>
        ) : (
          <LoadingState />
        )
      ) : (
        <View style={styles.pick}>
          <Text variant="title">{de.pledge.pickTitle}</Text>
          <QuickGoalCards />
        </View>
      )}
      <View style={styles.tiles}>
        <StreakFlame userId={session.user.id} />
        <CommunityCounter />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        accessibilityLabel={more ? de.home.less : de.home.more}
        onPress={() => {
          hapticSelect();
          setMore((value) => !value);
        }}
        style={styles.moreRow}
      >
        <Text color="textSecondary">{more ? de.home.less : de.home.more}</Text>
        <Icon name={more ? 'chevron-up' : 'chevron-down'} color="textSecondary" />
      </Pressable>

      {more ? (
        <View style={styles.moreBody}>
          {health.connected && primary ? (
            <Text variant="caption" color="textMuted">
              {lastSync}
            </Text>
          ) : null}
          {primary ? (
            <>
              <Text variant="label" color="textSecondary" accessibilityRole="header">
                {de.pledge.pickLabel}
              </Text>
              <QuickGoalCards />
            </>
          ) : null}
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
          <TodaySteps
            target={primary?.goal_type === 'steps_daily' ? primary.target_value : undefined}
          />
          {activePlan.data ? (
            <Card style={styles.plan}>
              <Text variant="heading" numberOfLines={1}>
                {de.training.plans[activePlan.data.planId].name}
              </Text>
              {nextRun ? (
                <Text color="textSecondary" numberOfLines={1}>
                  {de.home.nextRun(formatDayLabel(nextRun.date), formatDistance(nextRun.distanceM))}
                </Text>
              ) : null}
              <Button label={de.training.homeButton} onPress={() => router.push('/training')} />
            </Card>
          ) : (
            <Button
              label={de.home.startPlan}
              variant="secondary"
              onPress={() => router.push('/training')}
            />
          )}
          {primary ? null : (
            <Button label={de.home.run} variant="secondary" onPress={() => router.push('/run')} />
          )}
          <LastGoalResult />
          <CommunityCard />
          <WeekSummary userId={session.user.id} />
          <RecentWins userId={session.user.id} timezone={timezone} />
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.home.howLabel}
          </Text>
          <Card style={styles.plan}>
            {de.home.howSteps.map((step, index) => (
              <Text key={step} color="textSecondary">{`${index + 1}. ${step}`}</Text>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  idle: { alignItems: 'center', gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.xs },
  pick: {
    gap: spacing.md,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
  },
  moreBody: {
    gap: spacing.md,
  },
  others: {
    gap: spacing.sm,
  },
  plan: {
    gap: spacing.sm,
  },
});
