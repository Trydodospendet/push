import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Pill, ProgressBar, Text } from '@/components';
import { challengeDays, isGoalType, modeLabel } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { progressNumbers, progressRatio } from '@/features/health/progress';
import { de } from '@/i18n/de';
import { opacity, spacing } from '@/theme';

/** A small row of the overview of further goals: title, bar and the numbers. */
export function CompactGoal({
  challenge,
  value,
  now,
}: {
  challenge: Challenge;
  value: number;
  now: Date;
}) {
  const router = useRouter();
  if (!isGoalType(challenge.goal_type)) {
    return null;
  }
  const { days } = challengeDays(challenge);
  const numbers = progressNumbers(challenge.goal_type, value, challenge.target_value, days);
  const ratio = progressRatio(challenge.goal_type, value, challenge.target_value, days);
  const started = now >= new Date(challenge.starts_at);
  const line = started
    ? `${numbers.current} / ${numbers.goal} ${numbers.unit}`
    : de.home.notStarted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${challenge.title}, ${line}`}
      onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card}>
        <View style={styles.head}>
          <Text numberOfLines={1} style={styles.title}>
            {challenge.title}
          </Text>
          <Pill label={modeLabel(challenge.mode)} />
        </View>
        <ProgressBar progress={started ? ratio : 0} accessibilityLabel={de.progress.barLabel} />
        <Text variant="caption" color="textSecondary">
          {line}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
