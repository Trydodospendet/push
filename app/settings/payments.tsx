import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyPayments, useRealMoneyStatus } from '@/features/payments/api';
import { de } from '@/i18n/de';
import { formatDayLabel, toLocalDate } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Payment and pledge overview: whether real money is on, and every reservation with its status. */
export default function PaymentsScreen() {
  const session = useSession();
  const status = useRealMoneyStatus(session.user.id);
  const enabled = status.data === true;
  const payments = useMyPayments(session.user.id, enabled);

  if (status.isPending) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Card style={styles.card}>
        <Text variant="heading" color={enabled ? 'accent' : 'text'}>
          {enabled ? de.payments.onTitle : de.payments.offTitle}
        </Text>
        <Text color="textSecondary">{enabled ? de.payments.onText : de.payments.offText}</Text>
        {enabled ? (
          <Text variant="caption" color="textMuted">
            {de.payments.noReceipt}
          </Text>
        ) : null}
      </Card>
      {enabled ? (
        <View style={styles.list}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.payments.listLabel}
          </Text>
          {payments.isPending ? (
            <LoadingState />
          ) : payments.isError ? (
            <ErrorState
              message={de.payments.error}
              onRetry={() => payments.refetch()}
              retrying={payments.isFetching}
            />
          ) : payments.data.length === 0 ? (
            <EmptyState
              icon="card-outline"
              title={de.payments.empty}
              text=""
              actionLabel={de.payments.emptyAction}
              onAction={() => router.push('/')}
              compact
            />
          ) : (
            payments.data.map((payment) => (
              <Card key={payment.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text>{de.payments.status[payment.status]}</Text>
                  <Text variant="caption" color="textSecondary">
                    {formatDayLabel(toLocalDate(new Date(payment.createdAt), 'Europe/Berlin'))}
                  </Text>
                </View>
                <Text variant="heading" color={payment.status === 'captured' ? 'danger' : 'text'}>
                  {`${formatAmount(payment.amountCents)} €`}
                </Text>
              </Card>
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.xs },
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowText: { gap: spacing.xxs, flexShrink: 1 },
});
