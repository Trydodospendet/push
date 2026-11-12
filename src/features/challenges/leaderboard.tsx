import { StyleSheet, View } from 'react-native';

import { Avatar, Card, ErrorState, LoadingState, Pill, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { useLeaderboard } from './api';
import type { Challenge } from './types';

/**
 * Ranking of a ranked challenge, ordered by the server. Shows only the order and who
 * reached the goal – never the progress values of others. Display only, no payout by rank.
 */
export function Leaderboard({ challenge }: { challenge: Challenge }) {
  const leaderboard = useLeaderboard(challenge.id, true);
  const missedLabel =
    challenge.status === 'settled' ? de.challenge.resultFailed : de.challenge.resultOpen;

  if (leaderboard.isPending) {
    return <LoadingState />;
  }
  if (leaderboard.isError) {
    return (
      <ErrorState
        message={de.challenge.rankingError}
        onRetry={() => leaderboard.refetch()}
        retrying={leaderboard.isFetching}
      />
    );
  }
  if (leaderboard.data.length === 0) {
    return <Text color="textMuted">{de.challenge.rankingEmpty}</Text>;
  }

  return (
    <Card style={styles.list}>
      {leaderboard.data.map((entry) => {
        const name = entry.isMe ? `${entry.displayName} ${de.challenge.you}` : entry.displayName;
        const status = entry.goalReached ? de.challenge.resultDone : missedLabel;
        return (
          <View
            key={entry.userId}
            style={styles.row}
            accessible
            accessibilityLabel={`${de.challenge.rank(entry.rank)} ${name}: ${status}`}
          >
            <Text
              variant="heading"
              color={entry.isMe ? 'accent' : 'textSecondary'}
              style={styles.rank}
            >
              {de.challenge.rank(entry.rank)}
            </Text>
            <Avatar name={entry.displayName} size="sm" highlight={entry.isMe} />
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Pill label={status} tone={entry.goalReached ? 'accent' : 'neutral'} />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rank: {
    minWidth: spacing.xl,
    fontVariant: ['tabular-nums'],
  },
  name: {
    flex: 1,
  },
});
