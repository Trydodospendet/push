import { StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { de } from '@/i18n/de';
import { formatWeekdayShort } from '@/lib/dates';
import { colors, layout, radius, spacing } from '@/theme';

import type { WeekDay } from './api';

const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** Bar height in points; days without a run get a small stub so the row stays readable. */
export function barHeight(distanceM: number, maxM: number): number {
  const { height, minBarHeight } = layout.chart;
  if (distanceM <= 0 || maxM <= 0) {
    return minBarHeight;
  }
  return Math.max(minBarHeight, Math.round((distanceM / maxM) * height));
}

/** Kilometres per day for the last seven days. Today is the last bar. */
export function WeekChart({ days }: { days: WeekDay[] }) {
  const maxM = Math.max(0, ...days.map((day) => day.distanceM));
  const totalM = days.reduce((sum, day) => sum + day.distanceM, 0);
  const summary = de.stats.weekSummary(kmFormat.format(totalM / 1000));

  return (
    <View style={styles.root} accessible accessibilityLabel={summary}>
      <View style={styles.bars}>
        {days.map((day, index) => {
          const isToday = index === days.length - 1;
          return (
            <View key={day.date} style={styles.column}>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {day.distanceM > 0 ? kmFormat.format(day.distanceM / 1000) : ' '}
              </Text>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight(day.distanceM, maxM) },
                    day.distanceM > 0 && styles.barActive,
                  ]}
                />
              </View>
              <Text variant="caption" color={isToday ? 'text' : 'textMuted'}>
                {formatWeekdayShort(day.date).replace('.', '')}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="caption" color="textSecondary">
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    alignItems: 'center',
    gap: spacing.xxs,
    flex: 1,
  },
  barArea: {
    height: layout.chart.height,
    justifyContent: 'flex-end',
  },
  bar: {
    width: layout.chart.barWidth,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  barActive: {
    backgroundColor: colors.accent,
  },
});
