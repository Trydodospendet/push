import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components';
import { healthSourceName } from '@/features/health/platform';
import { usePotentialWin } from '@/features/stats/api';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, layout, radius, spacing } from '@/theme';

import { isFinished, isSolo } from './format';
import type { Challenge } from './types';

/** Big pot (ranked), the most the user can win, and the "automatically checked" badge. */
export function PotCard({ challenge }: { challenge: Challenge }) {
  const solo = isSolo(challenge);
  const over = isFinished(challenge) || challenge.status === 'settling';
  const potential = usePotentialWin(challenge.id, !over);

  return (
    <Card style={styles.card}>
      {solo ? null : (
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
      )}

      {over ? null : (
        <View
          style={styles.win}
          accessible
          accessibilityLabel={
            typeof potential.data === 'number'
              ? `${de.detail.possibleWinLabel}: ${formatAmount(potential.data)} ${de.common.credits}`
              : de.detail.possibleWinLabel
          }
        >
          <Text variant="label" color="textSecondary">
            {de.detail.possibleWinLabel}
          </Text>
          {potential.isError || potential.data === null ? null : (
            <Text variant="title">
              {potential.isPending
                ? de.detail.possibleWinSetting
                : `${formatAmount(potential.data ?? 0)} ${de.common.credits}`}
            </Text>
          )}
          <Text variant="caption" color="textMuted">
            {solo ? de.detail.possibleWinHintSolo : de.detail.possibleWinHint}
          </Text>
        </View>
      )}

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
  win: {
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
