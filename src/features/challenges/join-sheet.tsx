import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

export type JoinSheetProps = {
  stakeCents: number;
  /** Solo goals bet on yourself; the texts differ from joining a ranked pool. */
  solo?: boolean;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  joining: boolean;
  error: string | null;
};

/** The only way to pay a stake: states it and the virtual-credits notice before paying. */
export function JoinSheet({
  stakeCents,
  solo = false,
  visible,
  onClose,
  onConfirm,
  joining,
  error,
}: JoinSheetProps) {
  const session = useSession();
  const balance = useWalletBalance(session.user.id);
  const stake = formatAmount(stakeCents);

  return (
    <Sheet
      visible={visible}
      title={solo ? de.joinSheet.soloTitle : de.joinSheet.title}
      onClose={onClose}
      closeLabel={de.joinSheet.cancel}
    >
      <Text>{solo ? de.joinSheet.soloStake(stake) : de.joinSheet.stake(stake)}</Text>
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
        <Button
          label={solo ? de.joinSheet.soloConfirm : de.joinSheet.confirm}
          onPress={onConfirm}
          loading={joining}
        />
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
