import { StyleSheet, View } from 'react-native';

import {
  Card,
  ChipGroup,
  ErrorState,
  LoadingState,
  SwitchRow,
  Text,
  type ChipOption,
} from '@/components';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

import {
  useMyChallengeDonation,
  useMyDonations,
  useMyDonationTotals,
  useNgos,
  useSetChallengeDonation,
  useSetDonationDefaults,
} from './api';

function useNgoOptions(): ChipOption<string>[] {
  const ngos = useNgos();
  return (ngos.data ?? []).map((ngo) => ({ value: ngo.id, label: ngo.name }));
}

/** Profile: donate the winnings by default, and to whom. */
export function DonationDefaultsCard({
  userId,
  donate,
  ngoId,
}: {
  userId: string;
  donate: boolean;
  ngoId: string | null;
}) {
  const save = useSetDonationDefaults(userId);
  const options = useNgoOptions();
  const selected = ngoId ?? options[0]?.value ?? '';

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.donations.label}
      </Text>
      <SwitchRow
        label={de.donations.defaultToggle}
        hint={de.donations.defaultHint}
        value={donate}
        disabled={save.isPending}
        onChange={(value) =>
          save.mutate({ donate: value, ngoId: ngoId ?? options[0]?.value ?? null })
        }
      />
      {donate && options.length > 0 ? (
        <ChipGroup
          label={de.donations.ngo}
          options={options}
          value={selected}
          onChange={(value) => save.mutate({ donate, ngoId: value })}
        />
      ) : null}
      {save.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {toUserMessage(save.error)}
        </Text>
      ) : null}
      <Text variant="caption" color="textMuted">
        {de.donations.placeholderNote}
      </Text>
    </Card>
  );
}

type Choice = 'default' | 'donate' | 'keep';

/** Challenge detail: decide for this pool whether the winnings are donated. */
export function ChallengeDonationCard({
  challengeId,
  locked = false,
}: {
  challengeId: string;
  locked?: boolean;
}) {
  const current = useMyChallengeDonation(challengeId, true);
  const save = useSetChallengeDonation(challengeId);
  const options = useNgoOptions();

  if (current.isPending) {
    return <LoadingState />;
  }
  if (current.isError || !current.data) {
    return (
      <ErrorState
        message={de.donations.error}
        onRetry={() => current.refetch()}
        retrying={current.isFetching}
      />
    );
  }

  const data = current.data;
  if (locked)
    return (
      <Card>
        <Text>{data.effectiveDonate ? de.donations.nowDonating : de.donations.nowKeeping}</Text>
        <Text variant="caption">{de.coach.locked}</Text>
      </Card>
    );
  const choice: Choice = data.donate === null ? 'default' : data.donate ? 'donate' : 'keep';
  const choices: ChipOption<Choice>[] = [
    { value: 'default', label: de.donations.useDefault },
    { value: 'donate', label: de.donations.donate },
    { value: 'keep', label: de.donations.keep },
  ];
  const ngo = data.ngoId ?? data.effectiveNgoId ?? options[0]?.value ?? '';

  const change = (next: Choice) =>
    save.mutate({
      donate: next === 'default' ? null : next === 'donate',
      ngoId: next === 'donate' ? ngo || null : null,
    });

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.donations.challengeLabel}
      </Text>
      <Text color="textSecondary">{de.donations.challengeText}</Text>
      <ChipGroup label={de.donations.choice} options={choices} value={choice} onChange={change} />
      {choice === 'donate' && options.length > 0 ? (
        <ChipGroup
          label={de.donations.ngo}
          options={options}
          value={ngo}
          onChange={(value) => save.mutate({ donate: true, ngoId: value })}
        />
      ) : null}
      <Text variant="caption" color="textMuted">
        {data.effectiveDonate ? de.donations.nowDonating : de.donations.nowKeeping}
      </Text>
      {save.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {toUserMessage(save.error)}
        </Text>
      ) : null}
    </Card>
  );
}

/** Profile: what the user donated, per NGO and as a list. */
export function DonationsOverview({ timezone }: { timezone: string }) {
  const totals = useMyDonationTotals();
  const list = useMyDonations();

  if (totals.isPending || list.isPending) {
    return <LoadingState />;
  }
  if (totals.isError || list.isError) {
    return (
      <ErrorState
        message={de.donations.error}
        onRetry={() => {
          void totals.refetch();
          void list.refetch();
        }}
        retrying={totals.isFetching || list.isFetching}
      />
    );
  }

  const sum = totals.data.reduce((acc, row) => acc + row.totalCents, 0);

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.donations.overviewLabel}
      </Text>
      {list.data.length === 0 ? (
        <Text color="textMuted">{de.donations.overviewEmpty}</Text>
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`${de.donations.total}: ${formatAmount(sum)} ${de.common.credits}`}
          >
            <Text variant="title">{`${formatAmount(sum)} ${de.common.credits}`}</Text>
            <Text variant="caption" color="textSecondary">
              {de.donations.total}
            </Text>
          </View>
          {totals.data.map((row) => (
            <View key={row.ngoId} style={styles.row}>
              <Text style={styles.grow}>{row.ngoName}</Text>
              <Text>{`${formatAmount(row.totalCents)} ${de.common.credits}`}</Text>
            </View>
          ))}
          {list.data.slice(0, 5).map((row, index) => (
            <View key={`${row.challengeId ?? 'x'}-${index}`} style={styles.row}>
              <View style={styles.grow}>
                <Text variant="caption">{row.title ?? de.wallet.unknownChallenge}</Text>
                <Text variant="caption" color="textMuted">
                  {`${row.ngoName} · ${formatDateTime(new Date(row.createdAt), timezone)}`}
                </Text>
              </View>
              <Text variant="caption">{`${formatAmount(row.amountCents)} ${de.common.credits}`}</Text>
            </View>
          ))}
        </>
      )}
      <Text variant="caption" color="textMuted">
        {de.common.virtualCreditsNotice}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
});
