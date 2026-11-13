import { StyleSheet, View } from 'react-native';

import { Card, ErrorState, LoadingState, Text } from '@/components';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

import { useMyStats } from './api';

const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** Total kilometres, won challenges and winnings – all numbers come from the server. */
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
    {
      label: de.stats.totalDistance,
      value: de.stats.km(kmFormat.format(stats.data.totalDistanceM / 1000)),
    },
    { label: de.stats.totalWins, value: String(stats.data.wins) },
    {
      label: de.stats.totalWon,
      value: `${formatAmount(stats.data.totalWonCents)} ${de.common.credits}`,
    },
  ];
  return (
    <Card style={styles.stats}>
      <Text variant="label" color="textSecondary">
        {de.stats.profileLabel}
      </Text>
      {items.map((item) => (
        <View
          key={item.label}
          style={styles.statRow}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <Text color="textSecondary">{item.label}</Text>
          <Text variant="heading" style={styles.statValue}>
            {item.value}
          </Text>
        </View>
      ))}
      <Text variant="caption" color="textMuted">
        {de.stats.totalWonHint}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: {
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
});
