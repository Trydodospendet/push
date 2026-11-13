import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Pill, Text } from '@/components';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import { describeGoal, formatPeriod, isSolo, isWeekly, modeLabel, statusLabel } from './format';
import type { Challenge } from './types';

export type ChallengeCardProps = {
  challenge: Challenge;
  /** Lime "Dabei" badge. */
  joined?: boolean;
  /** "Von dir" badge for challenges the user created but did not join. */
  created?: boolean;
  /** Lime outline; used for the weekly challenge at the top of the ranked tab. */
  featured?: boolean;
};

/** Compact, tappable summary of a challenge; opens the detail screen. */
export function ChallengeCard({
  challenge,
  joined = false,
  created = false,
  featured = false,
}: ChallengeCardProps) {
  const router = useRouter();
  const goal = describeGoal(challenge.goal_type, challenge.target_value);
  const period = formatPeriod(challenge);
  const stake = `${formatAmount(challenge.stake_cents)} ${de.common.credits}`;
  const solo = isSolo(challenge);
  const details = solo
    ? [period, stake]
    : [period, stake, de.challenge.participantCount(challenge.participant_count)];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[challenge.title, goal, ...details].join(', ')}
      onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } })}
      style={({ pressed }) => [styles.card, featured && styles.featured, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <View style={styles.badges}>
          {isWeekly(challenge) ? <Pill label={de.challenges.weeklyBadge} tone="accent" /> : null}
          <Pill label={modeLabel(challenge.mode)} />
          <Pill label={statusLabel(challenge.status)} />
          {joined && !solo ? <Pill label={de.challenges.joinedBadge} tone="accent" /> : null}
          {!joined && created ? <Pill label={de.challenges.createdBadge} /> : null}
        </View>
        <Text variant="heading" numberOfLines={2}>
          {challenge.title}
        </Text>
        <Text color="textSecondary">{goal}</Text>
        <Text variant="caption" color="textMuted">
          {details.join(' · ')}
        </Text>
      </View>
      <Icon name="chevron-forward" color="textMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  featured: {
    borderColor: colors.accent,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
});
