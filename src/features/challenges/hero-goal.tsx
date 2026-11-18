import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components';
import { GoalRing } from '@/features/challenges/goal-ring';
import { challengeDays, isGoalType } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { progressNumbers, progressRatio, remainingLabel } from '@/features/health/progress';
import { de } from '@/i18n/de';
import { formatDayLabel } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { opacity, spacing } from '@/theme';

/**
 * The one active goal on Home: label, the goal bar with the ring and the fur number below it,
 * the time left and the pledge, and the main button. Tapping the ring opens the details.
 */
export function HeroGoal({
  challenge,
  value,
  now,
  onMainAction,
  mainLabel,
  mainLoading = false,
}: {
  challenge: Challenge;
  /** Server-computed progress of the signed-in user. */
  value: number;
  now: Date;
  mainLabel: string;
  onMainAction: () => void;
  mainLoading?: boolean;
}) {
  const router = useRouter();
  if (!isGoalType(challenge.goal_type)) {
    return null;
  }
  const { days, firstDay } = challengeDays(challenge);
  const numbers = progressNumbers(challenge.goal_type, value, challenge.target_value, days);
  const ratio = progressRatio(challenge.goal_type, value, challenge.target_value, days);
  const started = now >= new Date(challenge.starts_at);
  const status =
    ratio >= 1
      ? de.progress.goalReached
      : started
        ? remainingLabel(new Date(challenge.ends_at), now)
        : de.progress.startsOn(formatDayLabel(firstDay));
  const unit = challenge.goal_type.startsWith('run') ? 'km' : numbers.unit;

  return (
    <View style={styles.root}>
      <Text variant="label" color="textSecondary" align="center" numberOfLines={1}>
        {`${de.home.label} · ${challenge.title}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={challenge.title}
        accessibilityHint={de.home.openGoal}
        onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } })}
        style={({ pressed }) => [styles.numberBlock, pressed && styles.pressed]}
      >
        <GoalRing
          ratio={ratio}
          value={numbers.current}
          caption={`${de.progress.of(numbers.goal)} ${unit}`}
          spoken={numbers.spoken}
          barLabel={de.progress.barLabel}
        />
      </Pressable>
      <View style={styles.bar}>
        <View style={styles.meta}>
          <Text variant="label" color="textSecondary">
            {status}
          </Text>
          <Text variant="label" color="textSecondary">
            {`${de.home.pledge} ${formatAmount(challenge.stake_cents)}`}
          </Text>
        </View>
      </View>
      <Button label={mainLabel} onPress={onMainAction} loading={mainLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, alignItems: 'stretch' },
  numberBlock: { alignItems: 'stretch' },
  bar: { gap: spacing.xs },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  pressed: { opacity: opacity.pressed },
});
