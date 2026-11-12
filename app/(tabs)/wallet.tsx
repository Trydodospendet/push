import { RefreshControl, StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, spacing } from '@/theme';

export default function WalletScreen() {
  const session = useSession();
  const balance = useWalletBalance(session.user.id);

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={balance.isRefetching}
          onRefresh={() => {
            void balance.refetch();
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  balance: {
    gap: spacing.xxs,
  },
});
