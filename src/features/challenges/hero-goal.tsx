import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, FidgetRing, Text } from '@/components';
import { FurNumber } from '@/features/fur/fur-number';
import { challengeDays, describeGoal, isGoalType } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { progressNumbers, progressRatio, remainingLabel } from '@/features/health/progress';
import { de } from '@/i18n/de';
import { formatDayLabel } from '@/lib/dates';
import { layout, opacity, spacing } from '@/theme';

/**
 * The one active goal on Home: a ring you can spin, the number inside, one status line and one
 * main button. Tapping the title opens the details.
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

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={challenge.title}
        accessibilityHint={de.home.openGoal}
        onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } })}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text variant="heading" align="center" numberOfLines={1}>
          {describeGoal(challenge.goal_type, challenge.target_value)}
        </Text>
      </Pressable>
      <FidgetRing
        progress={ratio}
        accessibilityLabel={`${de.progress.barLabel}: ${numbers.spoken}`}
      >
        <FurNumber
          value={numbers.current}
          height={64}
          maxWidth={layout.ring.size * layout.ring.holeShare - spacing.sm}
          label={numbers.spoken}
        />
        <Text variant="caption" color="textSecondary" align="center">
          {`${de.progress.of(numbers.goal)} ${numbers.unit}`}
        </Text>
      </FidgetRing>
      <Text variant="body" color={ratio >= 1 ? 'accent' : 'textSecondary'} align="center">
        {status}
      </Text>
      <Button label={mainLabel} fur onPress={onMainAction} loading={mainLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
