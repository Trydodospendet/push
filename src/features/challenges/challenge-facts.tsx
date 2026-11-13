import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

import { formatPeriod, isGoal, isRanked } from './format';
import type { Challenge } from './types';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

/** Period, stake, participants and pot – all values as computed by the server. */
export function ChallengeFacts({ challenge }: { challenge: Challenge }) {
  const participants = de.challenge.participantCount(challenge.participant_count);
  const ranked = isRanked(challenge);
  const goal = isGoal(challenge);
  return (
    <Card style={styles.card}>
      <Fact label={de.challenge.period} value={formatPeriod(challenge)} />
      {ranked ? null : (
        <Fact
          label={de.challenge.stake}
          value={`${formatAmount(challenge.stake_cents)} ${de.common.credits}`}
        />
      )}
      {goal ? null : (
        <Fact
          label={de.challenge.participants}
          value={
            challenge.max_participants === null
              ? participants
              : `${participants} (${de.challenge.maxParticipants(challenge.max_participants)})`
          }
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  fact: {
    flex: 1,
    gap: spacing.xxs,
  },
});
