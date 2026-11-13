import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Pill, Text } from '@/components';
import { challengeDays, formatSteps } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { AppealSheet } from '@/features/help/appeal-sheet';
import { de } from '@/i18n/de';
import { addDays, formatDateTime, formatDayLabel, toLocalDate } from '@/lib/dates';
import { spacing } from '@/theme';

import { useMyDailySteps, useMyWorkouts, type Workout } from './api';

const distanceFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function reasonText(reason: string | null): string {
  if (reason !== null && reason in de.activities.reason) {
    return de.activities.reason[reason as keyof typeof de.activities.reason];
  }
  return de.activities.unknownReason;
}

type ActivityListProps = {
  challenge: Challenge;
  userId: string;
};

/** What the server found for the user in the challenge period, including what does not count. */
export function ActivityList({ challenge, userId }: ActivityListProps) {
  return challenge.goal_type === 'steps_daily' || challenge.goal_type === 'steps_total' ? (
    <StepDays challenge={challenge} userId={userId} />
  ) : (
    <Runs challenge={challenge} userId={userId} />
  );
}

function Runs({ challenge, userId }: ActivityListProps) {
  const workouts = useMyWorkouts(userId, challenge.starts_at, challenge.ends_at, true);

  if (workouts.isPending) {
    return <LoadingState />;
  }
  if (workouts.isError) {
    return <ErrorState message={de.activities.error} onRetry={() => workouts.refetch()} />;
  }

  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.activities.runsTitle}
      </Text>
      {workouts.data.length === 0 ? (
        <Text color="textMuted">{de.activities.runsEmpty}</Text>
      ) : (
        <Card style={styles.list}>
          {workouts.data.map((workout) => (
            <RunRow key={workout.id} workout={workout} timezone={challenge.timezone} />
          ))}
        </Card>
      )}
    </View>
  );
}

function RunRow({ workout, timezone }: { workout: Workout; timezone: string }) {
  const [appealOpen, setAppealOpen] = useState(false);
  const canAppeal = !workout.isValid && workout.invalidReason !== 'manual_entry';
  const distance = `${distanceFormat.format(workout.distanceM / 1000)} km`;
  const minutes = Math.round(workout.durationS / 60);
  const title = de.activities.run(distance, minutes);
  const status = workout.isValid ? de.activities.counted : de.activities.notCounted;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[
        title,
        formatDateTime(new Date(workout.startAt), timezone),
        status,
        workout.isValid ? '' : reasonText(workout.invalidReason),
      ].join(', ')}
    >
      <View style={styles.rowText}>
        <Text>{title}</Text>
        <Text variant="caption" color="textMuted">
          {formatDateTime(new Date(workout.startAt), timezone)}
        </Text>
        {workout.isValid ? null : (
          <Text variant="caption" color="danger">
            {reasonText(workout.invalidReason)}
          </Text>
        )}
      </View>
      <Pill label={status} tone={workout.isValid ? 'accent' : 'neutral'} />
      {canAppeal ? (
        <>
          <Button
            label={de.appeals.button}
            variant="secondary"
            onPress={() => setAppealOpen(true)}
          />
          <AppealSheet
            target={{ workoutId: workout.id }}
            visible={appealOpen}
            onClose={() => setAppealOpen(false)}
          />
        </>
      ) : null}
    </View>
  );
}

function StepDays({ challenge, userId }: ActivityListProps) {
  const { firstDay, lastDay, days } = challengeDays(challenge);
  const steps = useMyDailySteps(userId, firstDay, lastDay, true);

  if (steps.isPending) {
    return <LoadingState />;
  }
  if (steps.isError) {
    return <ErrorState message={de.activities.error} onRetry={() => steps.refetch()} />;
  }

  const byDate = new Map(steps.data.map((day) => [day.date, day]));
  const today = toLocalDate(new Date(), challenge.timezone);
  // Days that have not begun yet cannot be missed, so they are not listed.
  const dates = Array.from({ length: days }, (_, index) => addDays(firstDay, index)).filter(
    (date) => date <= today,
  );

  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.activities.stepsTitle}
      </Text>
      {steps.data.length === 0 ? (
        <Text color="textMuted">{de.activities.stepsEmpty}</Text>
      ) : (
        <Card style={styles.list}>
          {dates.map((date) => {
            const day = byDate.get(date);
            // In "most steps" challenges every valid day just adds up; only daily goals pass or fail.
            const adds = challenge.goal_type === 'steps_total';
            const reached =
              day !== undefined && day.isValid && (adds || day.steps >= challenge.target_value);
            const label = day === undefined ? '–' : formatSteps(day.steps);
            const status = reached
              ? adds
                ? de.activities.counts
                : de.activities.dayDone
              : adds
                ? de.activities.notCounted
                : de.activities.dayOpen;
            return (
              <View
                key={date}
                style={styles.row}
                accessible
                accessibilityLabel={`${formatDayLabel(date)}, ${label}, ${status}`}
              >
                <View style={styles.rowText}>
                  <Text>{formatDayLabel(date)}</Text>
                  <Text variant="caption" color="textMuted">
                    {label}
                  </Text>
                  {day !== undefined && !day.isValid ? (
                    <Text variant="caption" color="danger">
                      {de.activities.stepsInvalid}
                    </Text>
                  ) : null}
                </View>
                <Pill label={status} tone={reached ? 'accent' : 'neutral'} />
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
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
