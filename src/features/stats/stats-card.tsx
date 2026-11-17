import { StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState, Text } from '@/components';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing, typography } from '@/theme';

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
    { label: de.stats.kpiStreak, value: String(stats.data.streakDays), accent: true },
    {
      label: de.stats.kpiKm,
      value: kmFormat.format(stats.data.totalDistanceM / 1000),
      accent: false,
    },
    { label: de.stats.kpiGoals, value: String(stats.data.wins), accent: false },
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
            color={item.accent ? 'accent' : 'text'}
            numberOfLines={1}
            adjustsFontSizeToFit
            align="left"
          >
            {item.value}
          </Text>
          <Text variant="label" color="textSecondary" numberOfLines={2} style={styles.kpiLabel}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  item: {
    flex: 1,
    gap: spacing.xxs,
    padding: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kpiLabel: { fontSize: 11, letterSpacing: 1 },
  value: {
    fontFamily: typography.display.fontFamily,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
});
