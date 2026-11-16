import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components';
import { healthSourceName } from '@/features/health/platform';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, layout, radius, spacing } from '@/theme';

import { isGoal, isPool } from './format';
import type { Challenge } from './types';

/** Bound pledge (pool or own goal) and the "automatically checked" badge. */
export function PotCard({ challenge }: { challenge: Challenge }) {
  const pool = isPool(challenge);
  const goal = isGoal(challenge);

  return (
    <Card style={styles.card}>
      {pool ? (
        <View
          style={styles.pot}
          accessible
          accessibilityLabel={`${de.challenge.pot}: ${formatAmount(challenge.pot_cents ?? 0)} ${de.common.credits}`}
        >
          <Text variant="label" color="textSecondary">
            {de.detail.potLabel}
          </Text>
          <Text variant="display" color="accent" numberOfLines={1} adjustsFontSizeToFit>
            {formatAmount(challenge.pot_cents ?? 0)}
          </Text>
          <Text variant="caption" color="textSecondary">
            {`${de.common.credits} · ${de.detail.potCaption(challenge.participant_count)}`}
          </Text>
        </View>
      ) : null}

      {goal ? (
        <View
          style={styles.pot}
          accessible
          accessibilityLabel={`${de.detail.windowLabel}: ${formatAmount(challenge.stake_cents)} ${de.common.credits}`}
        >
          <Text variant="label" color="textSecondary">
            {de.detail.windowLabel}
          </Text>
          <Text variant="display" color="accent" numberOfLines={1} adjustsFontSizeToFit>
            {formatAmount(challenge.stake_cents)}
          </Text>
          <Text variant="caption" color="textSecondary">
            {`${de.common.credits} · ${de.detail.windowHint}`}
          </Text>
        </View>
      ) : null}

      <View
        style={styles.badge}
        accessible
        accessibilityLabel={`${de.detail.verified}. ${de.detail.verifiedHint(healthSourceName)}`}
      >
        <Icon name="shield-checkmark" color="accent" />
        <View style={styles.badgeText}>
          <Text variant="caption">{de.detail.verified}</Text>
          <Text variant="caption" color="textMuted">
            {de.detail.verifiedHint(healthSourceName)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  pot: {
    gap: spacing.xxs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRaised,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  badgeText: {
    flex: 1,
  },
});
