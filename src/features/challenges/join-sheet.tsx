import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

import type { Challenge } from './types';

export type JoinSheetProps = {
  challenge: Challenge;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  joining: boolean;
  error: string | null;
};

/** The only way to join: states the stake and the virtual-credits notice before paying. */
export function JoinSheet({
  challenge,
  visible,
  onClose,
  onConfirm,
  joining,
  error,
}: JoinSheetProps) {
  const session = useSession();
  const balance = useWalletBalance(session.user.id);

  return (
    <Sheet
      visible={visible}
      title={de.joinSheet.title}
      onClose={onClose}
      closeLabel={de.joinSheet.cancel}
    >
      <Text>{de.joinSheet.stake(formatAmount(challenge.stake_cents))}</Text>
      {balance.data !== undefined ? (
        <Text variant="caption" color="textSecondary">
          {de.joinSheet.balance(formatAmount(balance.data))}
        </Text>
      ) : null}
      <Text variant="caption" color="textMuted">
        {de.common.virtualCreditsNotice}
      </Text>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label={de.joinSheet.confirm} onPress={onConfirm} loading={joining} />
        <Button label={de.joinSheet.cancel} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
});
