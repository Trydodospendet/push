import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ErrorState, Icon, Pill, Skeleton, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import { useRunShapes } from './analytics-api';
import { useMyGpsRuns, type GpsRun } from './api';
import { formatClock, formatKm } from './format';
import { MiniRoute } from './mini-route';

function diagnostic(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return null;
  }
  return typeof error.message === 'string' ? error.message : null;
}

/** The user's own GPS runs, newest first, each with a mini map; tapping one opens its map. */
export function RunList({ timezone }: { timezone: string }) {
  const userId = useSession().user.id;
  const runs = useMyGpsRuns(userId);
  const shapes = useRunShapes(userId);

  if (runs.isPending) {
    return (
      <View style={styles.list}>
        <Skeleton height={spacing.xl + spacing.lg} />
        <Skeleton height={spacing.xl + spacing.lg} />
      </View>
    );
  }
  if (runs.isError) {
    const detail = diagnostic(runs.error);
    return (
      <ErrorState
        message={__DEV__ && detail ? `${de.run.historyError}\n${detail}` : de.run.historyError}
        onRetry={() => runs.refetch()}
        retrying={runs.isFetching}
      />
    );
  }
  if (runs.data.length === 0) {
    return <Text color="textMuted">{de.run.historyEmpty}</Text>;
  }
  return (
    <View style={styles.list}>
      {runs.data.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          timezone={timezone}
          shape={shapes.data?.get(run.id) ?? null}
        />
      ))}
    </View>
  );
}

function RunRow({
  run,
  timezone,
  shape,
}: {
  run: GpsRun;
  timezone: string;
  shape: [number, number][] | null;
}) {
  const router = useRouter();
  const line = de.run.runLine(formatKm(run.distanceM), formatClock(run.durationS));
  const when = formatDateTime(new Date(run.startedAt), timezone);
  const status = run.isValid ? de.run.counts : de.run.notCounted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${line}, ${when}, ${status}`}
      onPress={() => router.push({ pathname: '/run/[id]', params: { id: run.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.mini}>{shape ? <MiniRoute points={shape} /> : null}</View>
        <View style={styles.text}>
          <Text variant="heading">{line}</Text>
          <Text variant="caption" color="textMuted">
            {when}
          </Text>
        </View>
        <Pill label={status} tone={run.isValid ? 'accent' : 'neutral'} />
        <Icon name="chevron-forward" color="textMuted" />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.card,
    borderColor: colors.border,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mini: {
    width: spacing.xl + spacing.lg,
    height: spacing.xl + spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
});
