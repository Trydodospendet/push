import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Card,
  DraggablePanel,
  ErrorState,
  FadeIn,
  LoadingState,
  Pill,
  Screen,
  Text,
} from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import {
  recordsHeldBy,
  useMyRecords,
  useRunProfile,
  useRunSplits,
} from '@/features/gps/analytics-api';
import { useGpsRunRoute, useMyGpsRuns } from '@/features/gps/api';
import { ElevationProfile, PaceChart, SplitsTable } from '@/features/gps/charts';
import { formatClock, formatKm, formatPace } from '@/features/gps/format';
import { paceSecondsPerKm } from '@/features/gps/geo';
import { RouteMap } from '@/features/gps/route-map';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/**
 * One own GPS run: the map fills the screen (without the first and last 200 m – the server cuts
 * them off before the route reaches the phone) and the numbers sit in a panel that can be pulled
 * down: distance, time, pace, ascent, splits per kilometre, pace chart and elevation profile.
 */
export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const runs = useMyGpsRuns(session.user.id);
  const run = runs.data?.find((entry) => entry.id === id);
  const route = useGpsRunRoute(id, run?.hasRoute === true);
  const splits = useRunSplits(id);
  const profilePoints = useRunProfile(id);
  const records = useMyRecords(session.user.id);
  const [inset, setInset] = useState(0);
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
  const held = records.data ? recordsHeldBy(run, records.data) : [];
  const ascent = splits.data?.reduce((sum, split) => sum + (split.ascentM ?? 0), 0) ?? 0;
  const hasAscent = splits.data?.some((split) => split.ascentM !== null) ?? false;

  return (
    <View style={styles.root}>
      {run.hasRoute && route.data && route.data.length >= 2 ? (
        <RouteMap points={route.data} mode="fit" animate bottomInset={inset} />
      ) : null}
      <DraggablePanel
        toggleLabel={de.runStats.panelToggle}
        onHeight={setInset}
        maxShare={0.7}
        header={
          <View style={styles.header}>
            <View style={styles.headRow}>
              <Text variant="label" color="textSecondary">
                {formatDateTime(new Date(run.startedAt), timezone)}
              </Text>
              <View style={styles.pills}>
                {held.map((kind) => (
                  <Pill key={kind} label={de.runStats.newRecord} tone="accent" />
                ))}
                <Pill
                  label={run.isValid ? de.run.counts : de.run.notCounted}
                  tone={run.isValid ? 'accent' : 'neutral'}
                />
              </View>
            </View>
            <Text variant="display" style={styles.number} adjustsFontSizeToFit numberOfLines={1}>
              {`${formatKm(run.distanceM)} km`}
            </Text>
          </View>
        }
      >
        {reason ? (
          <Text color="danger" accessibilityRole="alert">
            {reason}
          </Text>
        ) : null}
        <Card style={styles.stats}>
          <Stat label={de.run.time} value={formatClock(run.durationS)} />
          <Stat label={de.run.pace} value={formatPace(pace)} />
          {hasAscent ? (
            <Stat label={de.runStats.ascent} value={de.runStats.ascentValue(Math.round(ascent))} />
          ) : null}
        </Card>
        {!run.hasRoute ? <Text color="textMuted">{de.run.noRoute}</Text> : null}
        {route.isError ? <Text color="danger">{de.run.routeError}</Text> : null}
        <FadeIn>
          {splits.isPending ? (
            <LoadingState />
          ) : splits.isError ? (
            <ErrorState
              message={de.runStats.statsError}
              onRetry={() => splits.refetch()}
              retrying={splits.isFetching}
            />
          ) : (
            <SplitsTable splits={splits.data} />
          )}
        </FadeIn>
        {profilePoints.data ? <PaceChart points={profilePoints.data} /> : null}
        {profilePoints.data ? <ElevationProfile points={profilePoints.data} /> : null}
        <Text variant="caption" color="textMuted">
          {de.run.detailMapHint}
        </Text>
        <Text variant="caption" color="textMuted">
          {de.run.mapAttribution}
        </Text>
      </DraggablePanel>
    </View>
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
  root: {
    flex: 1,
  },
  header: {
    gap: spacing.xs,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.xs,
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
