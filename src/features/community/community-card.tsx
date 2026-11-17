import { Share, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components';
import { useClock } from '@/features/gps/use-clock';
import { useFriendCode, inviteLink } from '@/features/social/api';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

import { useCommunityEvents, useCommunityStats } from './api';
import { agoText, eventText } from './text';

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/**
 * Real numbers of everybody in PUSH (no invented activity): runs today, reached goals this
 * week, donations, a small feed of anonymous events and the invitation button. With little
 * data it shows an inviting text instead of zeros.
 */
export function CommunityCard() {
  const stats = useCommunityStats();
  const events = useCommunityEvents();
  const code = useFriendCode();
  const now = useClock(true);

  const lines: string[] = [];
  if (stats.data) {
    if (stats.data.runsToday > 0)
      lines.push(de.community.runsToday(numberFormat.format(stats.data.runsToday)));
    if (stats.data.goalsWeek > 0)
      lines.push(de.community.goalsWeek(numberFormat.format(stats.data.goalsWeek)));
    if (stats.data.donatedCents > 0)
      lines.push(de.community.donated(formatAmount(stats.data.donatedCents)));
  }
  const feed = events.data ?? [];

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.community.label}
      </Text>
      {stats.isPending ? null : lines.length > 0 ? (
        <View style={styles.lines}>
          {lines.map((line) => (
            <Text key={line} variant="heading" color="accent">
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <Text color="textSecondary">{de.community.quiet}</Text>
      )}
      {feed.length > 0 ? (
        <View style={styles.feed}>
          {feed.slice(0, 4).map((event) => (
            <View key={`${event.kind}-${event.at}-${event.value}`} style={styles.event}>
              <Text style={styles.eventText} numberOfLines={2}>
                {eventText(event)}
              </Text>
              <Text variant="caption" color="textMuted">
                {agoText(event.at, now)}
              </Text>
            </View>
          ))}
        </View>
      ) : events.isPending ? null : (
        <Text variant="caption" color="textMuted">
          {de.community.feedEmpty}
        </Text>
      )}
      <Button
        label={de.community.invite}
        variant="secondary"
        disabled={!code.data}
        onPress={() => {
          if (code.data) {
            void Share.share({
              message: de.social.inviteMessage(inviteLink(code.data), code.data),
            });
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  lines: { gap: spacing.xxs },
  feed: { gap: spacing.xs },
  event: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  eventText: { flex: 1 },
});
