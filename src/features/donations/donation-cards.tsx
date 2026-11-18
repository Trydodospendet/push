import { StyleSheet, View } from 'react-native';

import {
  Card,
  ChipGroup,
  ErrorState,
  Icon,
  LoadingState,
  Text,
  type ChipOption,
} from '@/components';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { colors, fontFamily, layout, radius, spacing } from '@/theme';

import {
  useCommunityDonations,
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

/** Profile: which organisation receives a missed pledge by default. */
export function DonationDefaultsCard({ userId, ngoId }: { userId: string; ngoId: string | null }) {
  const save = useSetDonationDefaults(userId);
  const options = useNgoOptions();
  const selected = ngoId ?? options[0]?.value ?? '';

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.donations.label}
      </Text>
      <Text color="textSecondary">{de.donations.defaultHint}</Text>
      {options.length > 0 ? (
        <ChipGroup
          label={de.donations.ngo}
          options={options}
          value={selected}
          onChange={(value) => save.mutate({ donate: true, ngoId: value })}
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

/** Challenge detail: the organisation that receives the pledge if the goal is missed. */
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
  const ngo = data.ngoId ?? data.effectiveNgoId ?? options[0]?.value ?? '';
  const ngoName = options.find((option) => option.value === ngo)?.label ?? '';
  if (locked) {
    return (
      <Card>
        <Text>{ngoName ? `${de.donations.nowDonating} ${ngoName}` : de.donations.nowDonating}</Text>
        <Text variant="caption">{de.coach.locked}</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.donations.challengeLabel}
      </Text>
      <Text color="textSecondary">{de.donations.challengeText}</Text>
      {options.length > 0 ? (
        <ChipGroup
          label={de.donations.ngo}
          options={options}
          value={ngo}
          onChange={(value) => save.mutate({ donate: true, ngoId: value })}
        />
      ) : null}
      {save.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {toUserMessage(save.error)}
        </Text>
      ) : null}
    </Card>
  );
}

/** "Gemeinsam gespendet diesen Monat": one number for the whole community. */
export function CommunityCounter() {
  const total = useCommunityDonations();
  if (total.isPending || total.isError) {
    return null;
  }
  const amount = formatAmount(total.data);
  return (
    <View
      style={styles.community}
      accessible
      accessibilityLabel={`${de.donations.communityLabel}: ${de.donations.communityValue(amount)}`}
    >
      <Icon name="heart-outline" color="accent" />
      <Text style={styles.communityValue} numberOfLines={1}>
        {de.donations.communityValue(amount)}
      </Text>
      <Text variant="caption" color="textSecondary">
        {de.donations.communityLabel}
      </Text>
    </View>
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
      <CommunityCounter />
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
  communityValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  community: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
