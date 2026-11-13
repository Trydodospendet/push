import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, Sheet, Text, type ChipOption } from '@/components';
import { STAKE_PRESETS_CENTS } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { DonationDefaultsCard } from '@/features/donations/donation-cards';
import { useSession } from '@/features/auth/auth-provider';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

export type JoinSheetProps = {
  mode: 'ranked' | 'pool';
  /** The stake suggested by the challenge (pools only). */
  stakeCents: number;
  visible: boolean;
  onClose: () => void;
  /** Called with the chosen stake (0 for ranked). */
  onConfirm: (stakeCents: number) => void;
  joining: boolean;
  error: string | null;
};

/**
 * The only way to join: a pool states the own stake (everybody chooses it) and the
 * virtual-credits notice before paying; a ranked challenge has no stake at all.
 */
export function JoinSheet({
  mode,
  stakeCents,
  visible,
  onClose,
  onConfirm,
  joining,
  error,
}: JoinSheetProps) {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const balance = useWalletBalance(session.user.id);
  const [chosen, setChosen] = useState<number | null>(null);
  const ranked = mode === 'ranked';
  const stake = chosen ?? stakeCents;

  const presets = [...new Set([...STAKE_PRESETS_CENTS, stakeCents])].sort((a, b) => a - b);
  const options: ChipOption<number>[] = presets.map((cents) => ({
    value: cents,
    label: formatAmount(cents),
    accessibilityLabel: `${formatAmount(cents)} ${de.common.credits}`,
  }));

  return (
    <Sheet
      visible={visible}
      title={ranked ? de.joinSheet.rankedTitle : de.joinSheet.title}
      onClose={onClose}
      closeLabel={de.joinSheet.cancel}
    >
      {ranked ? (
        <Text>{de.joinSheet.rankedText}</Text>
      ) : (
        <>
          <ChipGroup
            label={de.joinSheet.stakeLabel}
            options={options}
            value={stake}
            onChange={setChosen}
          />
          {profile.data ? (
            <DonationDefaultsCard
              userId={session.user.id}
              donate={profile.data.donate_default}
              ngoId={profile.data.default_ngo_id}
            />
          ) : null}
          <Text color="textMuted">{de.coach.locked}</Text>
          <Text>{de.joinSheet.stakeChosen(formatAmount(stake))}</Text>
          {balance.data !== undefined ? (
            <Text variant="caption" color="textSecondary">
              {de.joinSheet.balance(formatAmount(balance.data))}
            </Text>
          ) : null}
          <Text variant="caption" color="textMuted">
            {de.common.virtualCreditsNotice}
          </Text>
        </>
      )}
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={ranked ? de.joinSheet.rankedConfirm : de.joinSheet.confirm}
          onPress={() => onConfirm(ranked ? 0 : stake)}
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
