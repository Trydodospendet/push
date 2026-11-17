import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, EditorialHero, ProgressBar, Text } from '@/components';
import { FurNumber } from '@/features/fur/fur-number';
import {
  challengeDays,
  describeGoal,
  formatDistance,
  isGoalType,
} from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { useGps } from '@/features/gps/gps-provider';
import { progressNumbers, progressRatio, remainingLabel } from '@/features/health/progress';
import { de } from '@/i18n/de';
import { formatDayLabel } from '@/lib/dates';
import { opacity, spacing } from '@/theme';

const NUMBER_WIDTH = 300;

/**
 * The one active goal on Home, magazine style: the goal as a giant word behind Pushy, the
 * progress as one big fur number, one status line and one main button. Tapping the goal line
 * opens the details.
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
  const { recorder } = useGps();
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
  const isRun = challenge.goal_type.startsWith('run');
  const word = isRun ? formatDistance(challenge.target_value) : de.home.stepsWord;
  const unit = isRun ? 'km' : numbers.unit;
  const pose = ratio >= 1 ? 'cheer' : recorder.status === 'recording' ? 'run' : 'sit';

  return (
    <View style={styles.root}>
      <EditorialHero
        word={word}
        label={`${de.home.label} · ${describeGoal(challenge.goal_type, challenge.target_value).toUpperCase()}`}
        pose={pose}
      />
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={challenge.title}
          accessibilityHint={de.home.openGoal}
          onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } })}
          style={({ pressed }) => [styles.numberBlock, pressed && styles.pressed]}
        >
          <FurNumber
            value={numbers.current}
            height={88}
            maxWidth={NUMBER_WIDTH}
            label={numbers.spoken}
          />
          <Text variant="heading" color="textSecondary" align="center" style={styles.upper}>
            {`${de.progress.of(numbers.goal)} ${unit}`}
          </Text>
          <Text
            variant="label"
            color={ratio >= 1 ? 'accent' : 'textSecondary'}
            align="center"
            style={styles.status}
          >
            {status}
          </Text>
        </Pressable>
        <ProgressBar
          progress={ratio}
          accessibilityLabel={`${de.progress.barLabel}: ${numbers.spoken}`}
        />
        <Button label={mainLabel} fur onPress={onMainAction} loading={mainLoading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  body: { gap: spacing.md },
  numberBlock: { alignItems: 'center', gap: spacing.xs },
  status: { letterSpacing: 3, textTransform: 'uppercase' },
  upper: { textTransform: 'uppercase' },
  pressed: { opacity: opacity.pressed },
});
