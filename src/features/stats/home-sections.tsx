import { StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, LoadingState, Text } from '@/components';
import { useMyDailySteps } from '@/features/health/api';
import { useMyProfile } from '@/features/auth/api';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { addDays, toLocalDate, formatDateTime } from '@/lib/dates';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, layout, radius, spacing } from '@/theme';

import { useMyStats, useMyWeek, useMyWins } from './api';
import { WeekChart } from './week-chart';

const RECENT_WINS = 3;

/** Streak and the weekly chart. If the numbers cannot be loaded a short retry card appears. */
export function StreakAndWeek({ userId }: { userId: string }) {
  const stats = useMyStats(userId);
  const week = useMyWeek(userId);
  const profile = useMyProfile(userId);
  const today = toLocalDate(new Date(), profile.data?.timezone ?? DEFAULT_TIMEZONE);
  const steps = useMyDailySteps(userId, addDays(today, -6), today, true);

  if (stats.isPending || week.isPending) {
    return <LoadingState />;
  }
  if (stats.isError || week.isError) {
    return (
      <Card style={styles.errorCard}>
        <Text color="textSecondary">{de.stats.statsError}</Text>
        <Button
          label={de.common.retry}
          variant="secondary"
          loading={stats.isFetching || week.isFetching}
          onPress={() => {
            void stats.refetch();
            void week.refetch();
          }}
        />
      </Card>
    );
  }

  const streak = stats.data.streakDays;
  return (
    <>
      <Card
        style={styles.streak}
        accessible
        accessibilityLabel={`${streak > 0 ? de.stats.streak(streak) : de.stats.streakNone}. ${de.stats.streakHint}`}
      >
        <View style={styles.flame}>
          <Icon name="flame" color={streak > 0 ? 'onAccent' : 'textMuted'} />
        </View>
        <View style={styles.streakText}>
          <Text variant="heading">
            {streak > 0 ? de.stats.streak(streak) : de.stats.streakNone}
          </Text>
          <Text variant="caption" color="textSecondary">
            {de.stats.streakHint}
          </Text>
        </View>
      </Card>
      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.stats.weekLabel}
        </Text>
        <Card>
          <WeekChart days={week.data} />
          {steps.data ? (
            <Text>
              {steps.data
                .filter((day) => day.isValid)
                .reduce((sum, day) => sum + day.steps, 0)
                .toLocaleString('de-DE')}{' '}
              {de.coach.weekSteps}
            </Text>
          ) : null}
          <Text variant="caption" color="textMuted">
            {de.coach.stepsNote}
          </Text>
        </Card>
      </View>
    </>
  );
}

/** The latest wins with the real payouts booked by the server. */
export function RecentWins({ userId, timezone }: { userId: string; timezone: string }) {
  const wins = useMyWins(userId);

  if (wins.isPending || wins.isError) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.stats.recentWinsLabel}
      </Text>
      {wins.data.length === 0 ? (
        <EmptyState
          compact
          icon="trophy-outline"
          title={de.stats.recentWinsEmptyTitle}
          text={de.stats.recentWinsEmptyText}
        />
      ) : (
        <Card style={styles.wins}>
          {wins.data.slice(0, RECENT_WINS).map((win, index) => {
            const amount = formatAmount(win.payoutCents);
            return (
              <View
                key={win.challengeId}
                style={[styles.winRow, index > 0 && styles.divider]}
                accessible
                accessibilityLabel={de.stats.recentWinAccessibility(win.title, amount)}
              >
                <View style={styles.winText}>
                  <Text numberOfLines={1}>{win.title}</Text>
                  <Text variant="caption" color="textMuted">
                    {formatDateTime(new Date(win.settledAt), timezone)}
                  </Text>
                </View>
                <Text variant="heading" color="accent" style={styles.amount}>
                  {`+${amount}`}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    gap: spacing.sm,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flame: {
    width: layout.avatar.md,
    height: layout.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  streakText: {
    flex: 1,
    gap: spacing.xxs / 2,
  },
  section: {
    gap: spacing.sm,
  },
  wins: {
    paddingVertical: spacing.xs,
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.border,
  },
  winText: {
    flex: 1,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
});
