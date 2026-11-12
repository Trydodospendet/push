import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

import { formatPeriod, isSolo } from './format';
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
  if (isSolo(challenge)) {
    return (
      <Card style={styles.card}>
        <Fact label={de.challenge.period} value={formatPeriod(challenge)} />
        <Fact
          label={de.challenge.stake}
          value={`${formatAmount(challenge.stake_cents)} ${de.common.credits}`}
        />
      </Card>
    );
  }
  return (
    <Card style={styles.card}>
      <Fact label={de.challenge.period} value={formatPeriod(challenge)} />
      <View style={styles.row}>
        <Fact
          label={de.challenge.stake}
          value={`${formatAmount(challenge.stake_cents)} ${de.common.credits}`}
        />
        <Fact
          label={de.challenge.pot}
          value={`${formatAmount(challenge.pot_cents ?? 0)} ${de.common.credits}`}
        />
      </View>
      <Fact
        label={de.challenge.participants}
        value={
          challenge.max_participants === null
            ? participants
            : `${participants} (${de.challenge.maxParticipants(challenge.max_participants)})`
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fact: {
    flex: 1,
    gap: spacing.xxs,
  },
});
