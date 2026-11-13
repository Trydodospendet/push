import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ErrorState, Icon, LoadingState, Pill, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import { useMyGpsRuns, type GpsRun } from './api';
import { formatClock, formatKm } from './format';

/** The user's own GPS runs, newest first; tapping one opens its map. */
export function RunList({ timezone }: { timezone: string }) {
  const userId = useSession().user.id;
  const runs = useMyGpsRuns(userId);

  if (runs.isPending) {
    return <LoadingState />;
  }
  if (runs.isError) {
    return (
      <ErrorState
        message={de.run.historyError}
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
        <RunRow key={run.id} run={run} timezone={timezone} />
      ))}
    </View>
  );
}

function RunRow({ run, timezone }: { run: GpsRun; timezone: string }) {
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
  text: {
    flex: 1,
  },
});
