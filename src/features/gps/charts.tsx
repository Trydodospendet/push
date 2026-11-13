import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

import type { PeriodStat, ProfilePoint, Split } from './analytics-api';
import { formatKm, formatPace } from './format';

const CHART_HEIGHT = 96;
const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** Time and pace of every kilometre, as a table with bars (fast km = long bar). */
export function SplitsTable({ splits }: { splits: readonly Split[] }) {
  if (splits.length === 0) {
    return <Text color="textMuted">{de.runStats.noSplits}</Text>;
  }
  const paces = splits.map((split) => split.paceSPerKm);
  const slowest = Math.max(...paces);
  const fastest = Math.min(...paces);
  const span = Math.max(1, slowest - fastest);

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.runStats.splits}
      </Text>
      {splits.map((split) => {
        const partial = split.distanceM < 1000;
        // The fastest kilometre gets the full bar, the slowest 35 %.
        const width = 35 + (65 * (slowest - split.paceSPerKm)) / span;
        const label = partial ? `${formatKm(split.distanceM)} km` : String(split.km);
        const pace = formatPace(split.paceSPerKm);
        return (
          <View
            key={split.km}
            style={styles.splitRow}
            accessible
            accessibilityLabel={de.runStats.splitSpoken(label, pace)}
          >
            <Text variant="caption" color="textSecondary" style={styles.splitKm}>
              {label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { width: `${width}%` },
                  split.paceSPerKm === fastest && styles.barFastest,
                ]}
              />
            </View>
            <Text style={styles.splitPace}>{pace}</Text>
          </View>
        );
      })}
    </Card>
  );
}

/** Altitude over the distance as a filled line. */
export function ElevationProfile({ points }: { points: readonly ProfilePoint[] }) {
  const withAltitude = points.filter(
    (point): point is ProfilePoint & { altitudeM: number } => point.altitudeM !== null,
  );
  if (withAltitude.length < 2) {
    return null;
  }
  const width = 300;
  const minAlt = Math.min(...withAltitude.map((point) => point.altitudeM));
  const maxAlt = Math.max(...withAltitude.map((point) => point.altitudeM));
  const altSpan = Math.max(10, maxAlt - minAlt);
  const total = withAltitude[withAltitude.length - 1].distanceM;
  const x = (distance: number) => (distance / Math.max(1, total)) * width;
  const y = (altitude: number) =>
    CHART_HEIGHT - 8 - ((altitude - minAlt) / altSpan) * (CHART_HEIGHT - 20);
  const line = withAltitude
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(point.distanceM).toFixed(1)} ${y(point.altitudeM).toFixed(1)}`,
    )
    .join(' ');
  const area = `${line} L${width} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`;

  return (
    <Card
      style={styles.card}
      accessible
      accessibilityLabel={de.runStats.elevationSpoken(
        String(Math.round(minAlt)),
        String(Math.round(maxAlt)),
      )}
    >
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.runStats.elevation}
      </Text>
      <Svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Path d={area} fill={colors.accent} fillOpacity={0.14} />
        <Path d={line} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Line
          x1="0"
          y1={CHART_HEIGHT - 1}
          x2={width}
          y2={CHART_HEIGHT - 1}
          stroke={colors.border}
          strokeWidth={1}
        />
      </Svg>
      <View style={styles.axis}>
        <Text variant="caption" color="textMuted">
          {de.runStats.altitudeRange(String(Math.round(minAlt)), String(Math.round(maxAlt)))}
        </Text>
        <Text variant="caption" color="textMuted">
          {`${kmFormat.format(total / 1000)} km`}
        </Text>
      </View>
    </Card>
  );
}

/** Pace over the distance: a taller line means faster. */
export function PaceChart({ points }: { points: readonly ProfilePoint[] }) {
  if (points.length < 2) {
    return null;
  }
  const width = 300;
  const paces = points.map((point) => point.paceSPerKm);
  const slowest = Math.max(...paces);
  const fastest = Math.min(...paces);
  const span = Math.max(15, slowest - fastest);
  const total = points[points.length - 1].distanceM;
  const x = (distance: number) => (distance / Math.max(1, total)) * width;
  const y = (pace: number) => 8 + ((pace - fastest) / span) * (CHART_HEIGHT - 20);
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(point.distanceM).toFixed(1)} ${y(point.paceSPerKm).toFixed(1)}`,
    )
    .join(' ');

  return (
    <Card
      style={styles.card}
      accessible
      accessibilityLabel={de.runStats.paceSpoken(formatPace(fastest), formatPace(slowest))}
    >
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.runStats.paceChart}
      </Text>
      <Svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Path d={line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Line
          x1="0"
          y1={CHART_HEIGHT - 1}
          x2={width}
          y2={CHART_HEIGHT - 1}
          stroke={colors.border}
          strokeWidth={1}
        />
      </Svg>
      <View style={styles.axis}>
        <Text variant="caption" color="textMuted">
          {de.runStats.paceRange(formatPace(fastest), formatPace(slowest))}
        </Text>
      </View>
    </Card>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function periodLabel(periodStart: string, unit: 'week' | 'month'): string {
  const [, month, day] = periodStart.split('-').map(Number);
  return unit === 'month' ? MONTHS[month - 1] : `${day}.${month}.`;
}

/** Distance per week or month as bars; the current period is lime. */
export function PeriodChart({
  stats,
  unit,
}: {
  stats: readonly PeriodStat[];
  unit: 'week' | 'month';
}) {
  const max = Math.max(1, ...stats.map((stat) => stat.distanceM));
  const total = stats.reduce((sum, stat) => sum + stat.distanceM, 0);
  const runs = stats.reduce((sum, stat) => sum + stat.runs, 0);
  const barArea = layout.chart.height;

  return (
    <View
      accessible
      accessibilityLabel={de.runStats.periodSpoken(
        unit === 'week' ? de.runStats.weeks : de.runStats.months,
        formatKm(total),
        runs,
      )}
    >
      <View style={[styles.periodBars, { height: barArea }]}>
        {stats.map((stat, index) => {
          const height = Math.max(
            layout.chart.minBarHeight,
            (stat.distanceM / max) * (barArea - spacing.md),
          );
          const current = index === stats.length - 1;
          return (
            <View key={stat.periodStart} style={styles.periodColumn}>
              <View
                style={[
                  styles.periodBar,
                  { height },
                  current ? styles.periodBarCurrent : stat.distanceM === 0 && styles.periodBarEmpty,
                ]}
              />
              <Text variant="caption" color={current ? 'accent' : 'textMuted'} numberOfLines={1}>
                {periodLabel(stat.periodStart, unit)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="caption" color="textSecondary">
        {de.runStats.periodSummary(formatKm(total), runs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  splitKm: {
    width: spacing.xl + spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    flex: 1,
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  bar: {
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  barFastest: {
    backgroundColor: colors.accent,
  },
  splitPace: {
    width: spacing.xl + spacing.md,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  periodColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xxs,
  },
  periodBar: {
    width: layout.chart.barWidth,
    maxWidth: '80%',
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  periodBarCurrent: {
    backgroundColor: colors.accent,
  },
  periodBarEmpty: {
    backgroundColor: colors.border,
  },
});
