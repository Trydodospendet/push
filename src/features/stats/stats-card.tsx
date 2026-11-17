import { StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing, typography } from '@/theme';

import { useMyStats } from './api';

const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** Three big key figures (streak, kilometres, reached goals); all numbers come from the server. */
export function StatsCard({ userId }: { userId: string }) {
  const stats = useMyStats(userId);
  if (stats.isPending) {
    return <LoadingState />;
  }
  if (stats.isError) {
    return (
      <ErrorState
        message={de.stats.statsError}
        onRetry={() => stats.refetch()}
        retrying={stats.isFetching}
      />
    );
  }
  const items = [
    { label: de.stats.kpiStreak, value: String(stats.data.streakDays) },
    { label: de.stats.kpiKm, value: kmFormat.format(stats.data.totalDistanceM / 1000) },
    { label: de.stats.kpiGoals, value: String(stats.data.wins) },
  ];
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View
          key={item.label}
          style={styles.item}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <Text
            style={styles.value}
            color="accent"
            numberOfLines={1}
            adjustsFontSizeToFit
            align="center"
          >
            {item.value}
          </Text>
          <Text variant="label" color="textSecondary" align="center" numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flex: 1, gap: spacing.xxs, alignItems: 'stretch' },
  value: {
    fontFamily: typography.display.fontFamily,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
});
