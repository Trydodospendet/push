import { TodaySteps } from './today-card';
import { StyleSheet, View } from 'react-native';

import { ProgressBar, ProgressRing, Text } from '@/components';
import { challengeDays, describeGoal, isGoalType } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { de } from '@/i18n/de';
import { formatDayLabel } from '@/lib/dates';
import { spacing } from '@/theme';

import { progressNumbers, progressRatio, remainingLabel } from './progress';

export type ProgressSummaryProps = {
  challenge: Challenge;
  /** Server-computed progress of the signed-in user. */
  value: number;
  now: Date;
  /** Rendered below the bar, e.g. the last sync time. */
  footer?: string | null;
  /** Ring with the number inside instead of the bar (Home). */
  ring?: boolean;
};

/** The big number, the lime bar (or ring) and the remaining time of one challenge. */
export function ProgressSummary({
  challenge,
  value,
  now,
  footer,
  ring = false,
}: ProgressSummaryProps) {
  if (!isGoalType(challenge.goal_type)) {
    return null;
  }
  const { days, firstDay } = challengeDays(challenge);
  const numbers = progressNumbers(challenge.goal_type, value, challenge.target_value, days);
  const ratio = progressRatio(challenge.goal_type, value, challenge.target_value, days);
  const started = now >= new Date(challenge.starts_at);
  const timeLine = started
    ? remainingLabel(new Date(challenge.ends_at), now)
    : de.progress.startsOn(formatDayLabel(firstDay));

  const status = (
    <Text
      variant="caption"
      color={ratio >= 1 ? 'accent' : 'textSecondary'}
      align={ring ? 'center' : undefined}
    >
      {ratio >= 1 ? de.progress.goalReached : timeLine}
    </Text>
  );
  const footerText = footer ? (
    <Text variant="caption" color="textMuted" align={ring ? 'center' : undefined}>
      {footer}
    </Text>
  ) : null;

  if (ring) {
    return (
      <View style={styles.root}>
        <Text variant="caption" color="textSecondary" align="center">
          {describeGoal(challenge.goal_type, challenge.target_value)}
        </Text>
        <ProgressRing
          progress={ratio}
          accessibilityLabel={`${de.progress.barLabel}: ${numbers.spoken}`}
        >
          <Text variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
            {numbers.current}
          </Text>
          <Text variant="caption" color="textSecondary" align="center">
            {`${de.progress.of(numbers.goal)} ${numbers.unit}`}
          </Text>
        </ProgressRing>
        {status}
        {footerText}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text variant="caption" color="textSecondary">
        {describeGoal(challenge.goal_type, challenge.target_value)}
      </Text>
      <View accessible accessibilityLabel={numbers.spoken} style={styles.numbers}>
        <Text variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {`${numbers.current} / ${numbers.goal}`}
        </Text>
        <Text variant="heading" color="textSecondary">
          {numbers.unit}
        </Text>
      </View>
      <ProgressBar progress={ratio} accessibilityLabel={de.progress.barLabel} />
      {status}
      {challenge.goal_type === 'steps_daily' ? (
        <TodaySteps target={challenge.target_value} />
      ) : null}
      {footerText}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  numbers: {
    gap: spacing.xxs,
  },
});
