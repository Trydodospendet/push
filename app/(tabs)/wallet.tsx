import { RefreshControl, StyleSheet, View } from 'react-native';

import { Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useLedger, useWalletBalance, type LedgerEntry } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { formatDateTime } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { colors, layout, spacing } from '@/theme';

export default function WalletScreen() {
  const session = useSession();
  const balance = useWalletBalance(session.user.id);
  const ledger = useLedger(session.user.id);

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={balance.isRefetching || ledger.isRefetching}
          onRefresh={() => {
            void balance.refetch();
            void ledger.refetch();
          }}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <Text variant="label" color="textSecondary">
        {de.wallet.label}
      </Text>
      {balance.isPending ? (
        <LoadingState />
      ) : balance.isError ? (
        <ErrorState
          message={de.wallet.error}
          onRetry={() => balance.refetch()}
          retrying={balance.isFetching}
        />
      ) : (
        <View
          style={styles.balance}
          accessible
          accessibilityLabel={de.wallet.balanceAccessibility(formatAmount(balance.data))}
        >
          <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
            {formatAmount(balance.data)}
          </Text>
          <Text variant="heading" color="textSecondary">
            {de.common.credits}
          </Text>
        </View>
      )}
      <Text variant="caption" color="textMuted">
        {de.common.virtualCreditsNotice}
      </Text>

      <View style={styles.history}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.wallet.history}
        </Text>
        {ledger.isPending ? (
          <LoadingState />
        ) : ledger.isError ? (
          <ErrorState
            message={de.wallet.historyError}
            onRetry={() => ledger.refetch()}
            retrying={ledger.isFetching}
          />
        ) : ledger.data.length === 0 ? (
          <Text color="textMuted">{de.wallet.historyEmpty}</Text>
        ) : (
          <Card style={styles.entries}>
            {ledger.data.map((entry, index) => (
              <LedgerRow key={entry.id} entry={entry} divider={index > 0} />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function entryLabel(type: string): string {
  return type in de.wallet.entryType
    ? de.wallet.entryType[type as keyof typeof de.wallet.entryType]
    : type;
}

function LedgerRow({ entry, divider }: { entry: LedgerEntry; divider: boolean }) {
  const label = entryLabel(entry.type);
  const sign = entry.amountCents > 0 ? '+' : '−';
  const amount = `${sign}${formatAmount(Math.abs(entry.amountCents))}`;
  const date = formatDateTime(new Date(entry.createdAt), DEFAULT_TIMEZONE);
  const challenge =
    entry.challengeTitle ?? (entry.type === 'signup_bonus' ? null : de.wallet.unknownChallenge);

  return (
    <View
      style={[styles.row, divider && styles.divider]}
      accessible
      accessibilityLabel={[label, challenge, `${amount} ${de.common.credits}`, date]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.rowText}>
        <Text>{label}</Text>
        {challenge ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {challenge}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {date}
        </Text>
      </View>
      <Text variant="heading" style={styles.amount}>
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  balance: {
    gap: spacing.xxs,
  },
  history: {
    gap: spacing.sm,
  },
  entries: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs / 2,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
});
