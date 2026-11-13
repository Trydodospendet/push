import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, ErrorState, Icon, LoadingState, Text } from '@/components';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import { useChallengeFeed, useCheer, type FeedEntry } from './api';
import { feedSentence } from './feed-text';

/** What happened in a ranked challenge. Only participants see this; it holds no health details. */
export function ChallengeFeed({
  challengeId,
  timezone,
}: {
  challengeId: string;
  timezone: string;
}) {
  const feed = useChallengeFeed(challengeId);
  const cheer = useCheer(challengeId);

  if (feed.isPending) {
    return <LoadingState />;
  }
  if (feed.isError) {
    return (
      <ErrorState
        message={de.feed.error}
        onRetry={() => feed.refetch()}
        retrying={feed.isFetching}
      />
    );
  }
  if (feed.data.length === 0) {
    return <Text color="textMuted">{de.feed.empty}</Text>;
  }

  return (
    <Card style={styles.list}>
      {cheer.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {toUserMessage(cheer.error)}
        </Text>
      ) : null}
      {feed.data.map((entry) => (
        <FeedRow
          key={entry.id}
          entry={entry}
          timezone={timezone}
          cheering={cheer.isPending && cheer.variables === entry.id}
          onCheer={() => cheer.mutate(entry.id)}
        />
      ))}
    </Card>
  );
}

function FeedRow({
  entry,
  timezone,
  cheering,
  onCheer,
}: {
  entry: FeedEntry;
  timezone: string;
  cheering: boolean;
  onCheer: () => void;
}) {
  const sentence = feedSentence(entry);
  const when = formatDateTime(new Date(entry.createdAt), timezone);
  const canCheer = !entry.isMine && !entry.cheeredByMe;

  return (
    <View style={styles.row}>
      <Avatar name={entry.displayName} size="sm" highlight={entry.isMine} />
      <View style={styles.text}>
        <Text>{sentence}</Text>
        <Text variant="caption" color="textMuted">
          {when}
        </Text>
      </View>
      {entry.isMine ? (
        entry.cheerCount > 0 ? (
          <View
            style={styles.received}
            accessible
            accessibilityLabel={de.feed.cheersReceived(entry.cheerCount)}
          >
            <Icon name="flame" color="accent" size={18} />
            <Text color="accent" style={styles.count}>
              {String(entry.cheerCount)}
            </Text>
          </View>
        ) : null
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            entry.cheeredByMe ? de.feed.cheeredLabel(sentence) : de.feed.cheerLabel(sentence)
          }
          accessibilityState={{ disabled: !canCheer || cheering, selected: entry.cheeredByMe }}
          disabled={!canCheer || cheering}
          onPress={onCheer}
          style={({ pressed }) => [
            styles.cheer,
            entry.cheeredByMe && styles.cheered,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="flame" color={entry.cheeredByMe ? 'onAccent' : 'accent'} size={18} />
          <Text variant="caption" color={entry.cheeredByMe ? 'onAccent' : 'text'}>
            {entry.cheerCount > 0 ? String(entry.cheerCount) : de.feed.cheer}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
  received: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
  cheer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  cheered: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
