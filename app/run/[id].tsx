import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, ErrorState, LoadingState, Pill, Screen, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useGpsRunRoute, useMyGpsRuns } from '@/features/gps/api';
import { formatClock, formatKm, formatPace } from '@/features/gps/format';
import { paceSecondsPerKm } from '@/features/gps/geo';
import { RouteMap } from '@/features/gps/route-map';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/**
 * One own GPS run: map without the first and last 200 m (the server cuts them off before the
 * route reaches the phone), distance, time, pace and – if it does not count – why.
 */
export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const runs = useMyGpsRuns(session.user.id);
  const run = runs.data?.find((entry) => entry.id === id);
  const route = useGpsRunRoute(id, run?.hasRoute === true);
  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;

  if (runs.isPending) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <LoadingState />
      </Screen>
    );
  }
  if (runs.isError || !run) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <ErrorState
          message={de.run.historyError}
          onRetry={() => runs.refetch()}
          retrying={runs.isFetching}
        />
      </Screen>
    );
  }

  const pace = paceSecondsPerKm(run.distanceM, run.durationS);
  const reason =
    !run.isValid && run.invalidReason
      ? (de.activities.reason as Record<string, string>)[run.invalidReason]
      : undefined;

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="label" color="textSecondary">
          {formatDateTime(new Date(run.startedAt), timezone)}
        </Text>
        <Pill
          label={run.isValid ? de.run.counts : de.run.notCounted}
          tone={run.isValid ? 'accent' : 'neutral'}
        />
      </View>
      {reason ? (
        <Text color="danger" accessibilityRole="alert">
          {reason}
        </Text>
      ) : null}
      <Card style={styles.stats}>
        <Stat label={de.run.distance} value={formatKm(run.distanceM)} />
        <Stat label={de.run.time} value={formatClock(run.durationS)} />
        <Stat label={de.run.pace} value={formatPace(pace)} />
      </Card>
      {!run.hasRoute ? (
        <Text color="textMuted">{de.run.noRoute}</Text>
      ) : route.isPending ? (
        <LoadingState />
      ) : route.isError ? (
        <ErrorState
          message={de.run.routeError}
          onRetry={() => route.refetch()}
          retrying={route.isFetching}
        />
      ) : route.data.length < 2 ? (
        <Text color="textMuted">{de.run.noRoute}</Text>
      ) : (
        <>
          <RouteMap points={route.data} mode="fit" height={320} />
          <Text variant="caption" color="textMuted">
            {de.run.detailMapHint}
          </Text>
          <Text variant="caption" color="textMuted">
            {de.run.mapAttribution}
          </Text>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Text variant="title" style={styles.number}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    gap: spacing.xxs,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
