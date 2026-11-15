import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Pill,
  Screen,
  Text,
} from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { formatSteps } from '@/features/challenges/format';
import { HistoryMap } from '@/features/gps/history-map';
import { RunList } from '@/features/gps/run-list';
import { activityKeys, useRecentWorkouts, type RecentWorkout } from '@/features/health/api';
import { reasonText } from '@/features/health/activity-list';
import { useHealth } from '@/features/health/health-provider';
import { healthSourceName, isAndroid } from '@/features/health/platform';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
import { de } from '@/i18n/de';
import { addDays, formatDateTime, formatDayLabel, toLocalDate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

const distanceFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const STEP_DAYS = 7;

/** The last seven days of steps, read for the activity overview (all valid or not). */
function useRecentSteps(userId: string, from: string, to: string) {
  return useQuery({
    queryKey: [...activityKeys.all, 'recent-steps', userId, from, to] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_daily_steps')
        .select('date, steps, is_valid')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });
      if (error) {
        throw error;
      }
      return data.map((row) => ({ date: row.date, steps: row.steps, isValid: row.is_valid }));
    },
  });
}

/**
 * Everything the phone delivered: runs and steps are taken over automatically from Health
 * Connect / Apple Health. The own GPS recording is the option for people without a running app.
 */
export default function ActivityScreen() {
  const router = useRouter();
  const session = useSession();
  const userId = session.user.id;
  const profile = useMyProfile(userId);
  const health = useHealth();
  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;
  const lastSync = useLastSyncText(timezone);
  const workouts = useRecentWorkouts(userId);
  const today = toLocalDate(new Date(), timezone);
  const steps = useRecentSteps(userId, addDays(today, -(STEP_DAYS - 1)), today);

  const refresh = () => {
    void health.sync().then(() => {
      void workouts.refetch();
      void steps.refetch();
    });
  };

  const loading = workouts.isPending || steps.isPending;
  const failed = workouts.isError || steps.isError;
  const empty = !loading && !failed && workouts.data.length === 0 && steps.data.length === 0;

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={health.syncing}
          onRefresh={refresh}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.activityTab.title}
        </Text>
        <Text color="textSecondary">{de.activityTab.intro(healthSourceName)}</Text>
        {health.connected ? (
          <Text variant="caption" color="textMuted">
            {lastSync}
          </Text>
        ) : null}
      </View>

      <HealthBanner />

      <Button
        label={de.activityTab.record}
        variant="secondary"
        onPress={() => router.push('/run/index')}
      />
      <Button
        label={de.training.homeButton}
        variant="secondary"
        onPress={() => router.push('/training')}
      />

      {loading ? (
        <LoadingState />
      ) : failed ? (
        <ErrorState
          message={de.activityTab.loadError}
          onRetry={() => {
            void workouts.refetch();
            void steps.refetch();
          }}
          retrying={workouts.isFetching || steps.isFetching}
        />
      ) : empty ? (
        <EmptyState
          icon="walk-outline"
          title={de.activityTab.emptyTitle}
          text={health.connected ? de.activityTab.emptyText : de.activityTab.emptyNotConnected}
        />
      ) : (
        <>
          <View style={styles.section}>
            <Text variant="label" color="textSecondary" accessibilityRole="header">
              {de.activityTab.runs}
            </Text>
            {workouts.data.length === 0 ? (
              <Text color="textMuted">{de.activityTab.runsEmpty}</Text>
            ) : (
              <Card style={styles.list}>
                {workouts.data.map((workout) => (
                  <WorkoutRow key={workout.id} workout={workout} timezone={timezone} />
                ))}
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <Text variant="label" color="textSecondary" accessibilityRole="header">
              {de.activityTab.steps}
            </Text>
            {steps.data.length === 0 ? (
              <Text color="textMuted">{de.activityTab.stepsEmpty}</Text>
            ) : (
              <Card style={styles.list}>
                {steps.data.map((day) => (
                  <View
                    key={day.date}
                    style={styles.row}
                    accessible
                    accessibilityLabel={`${formatDayLabel(day.date)}, ${formatSteps(day.steps)}`}
                  >
                    <View style={styles.rowText}>
                      <Text>{formatDayLabel(day.date)}</Text>
                      {day.isValid ? null : (
                        <Text variant="caption" color="danger">
                          {de.activities.stepsInvalid}
                        </Text>
                      )}
                    </View>
                    <Text color={day.isValid ? 'text' : 'textMuted'}>{formatSteps(day.steps)}</Text>
                  </View>
                ))}
              </Card>
            )}
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.activityTab.gpsRuns}
        </Text>
        <HistoryMap />
        <RunList timezone={timezone} />
      </View>
    </Screen>
  );
}

function WorkoutRow({ workout, timezone }: { workout: RecentWorkout; timezone: string }) {
  const router = useRouter();
  const distance = `${distanceFormat.format(workout.distanceM / 1000)} km`;
  const title = de.activities.run(distance, Math.round(workout.durationS / 60));
  const status = workout.isValid ? de.activities.counted : de.activities.notCounted;
  const when = formatDateTime(new Date(workout.startAt), timezone);
  // Routes exist only in Health Connect (Android); HealthKit routes are not read.
  const canShowRoute = isAndroid && workout.platform === 'android';

  return (
    <View style={styles.workout}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={[
          title,
          when,
          status,
          workout.isValid ? '' : reasonText(workout.invalidReason),
        ].join(', ')}
      >
        <View style={styles.rowText}>
          <Text>{title}</Text>
          <Text variant="caption" color="textMuted">
            {when}
          </Text>
          {workout.isValid ? null : (
            <Text variant="caption" color="danger">
              {reasonText(workout.invalidReason)}
            </Text>
          )}
        </View>
        <Pill label={status} tone={workout.isValid ? 'accent' : 'neutral'} />
      </View>
      {canShowRoute ? (
        <Button
          label={de.activityTab.showRoute}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/activity/[recordId]',
              params: { recordId: workout.sourceRecordId, startAt: workout.startAt },
            })
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  workout: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs / 2,
  },
});
