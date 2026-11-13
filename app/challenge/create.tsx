import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, Screen, Sheet, Text, TextField, type ChipOption } from '@/components';
import {
  DEFAULT_TIMEZONE,
  GOAL_PERIODS,
  GOAL_TYPES,
  STAKE_PRESETS_CENTS,
  TARGET_PRESETS,
  type GoalPeriod,
  type GoalType,
} from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useCreateGoal } from '@/features/challenges/api';
import { describeGoal, formatTarget, suggestTitle } from '@/features/challenges/format';
import { createGoalSchema, goalPeriodDays } from '@/features/challenges/schemas';
import { useNgos } from '@/features/donations/api';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { addDays, formatDayLabel, toLocalDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

const DEFAULT_TARGET: Record<GoalType, number> = {
  run_single: 5_000,
  run_total: 10_000,
  steps_daily: 10_000,
  steps_total: 70_000,
};

const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' });

/** e.g. 'am Sa., 14.11.' / 'Mo., 16.11. – So., 22.11.' / 'Dezember' for the title of a goal. */
function periodLabel(period: GoalPeriod, first: string, last: string): string {
  if (period === 'day') {
    return formatDayLabel(first);
  }
  if (period === 'week') {
    return `${formatDayLabel(first)} – ${formatDayLabel(last)}`;
  }
  return monthName.format(new Date(`${first}T00:00:00Z`));
}

/**
 * "Ziel setzen": goal type, target, period and stake. Nothing is booked before the
 * confirmation sheet states the stake, when it comes back and that it is bound from the start.
 */
export default function SetGoalScreen() {
  const router = useRouter();
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const ngos = useNgos();
  const [donate, setDonate] = useState(false);
  const [ngoId, setNgoId] = useState<string | null>(null);
  const balance = useWalletBalance(session.user.id);
  const create = useCreateGoal();

  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;
  const today = toLocalDate(new Date(), timezone);

  const [goalType, setGoalType] = useState<GoalType>('run_total');
  const [targetValue, setTargetValue] = useState(DEFAULT_TARGET.run_total);
  const [customTarget, setCustomTarget] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [stakeCents, setStakeCents] = useState<number>(1_000);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetDates = goalPeriodDays(today, period);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [withFriends, setWithFriends] = useState(false);
  const first = startDate || presetDates.first;
  const last = endDate || presetDates.last;
  const label = startDate || endDate ? `${first} – ${last}` : periodLabel(period, first, last);
  const title = `${suggestTitle(goalType, targetValue)} · ${label}`;
  // The settlement follows 24 hours after the period ended (time to synchronise).

  const goalOptions: ChipOption<GoalType>[] = GOAL_TYPES.map((type) => ({
    value: type,
    label: de.goal.typeLabel[type],
  }));
  const targetOptions: ChipOption<number>[] = TARGET_PRESETS[goalType].map((value) => ({
    value,
    label: formatTarget(goalType, value),
  }));
  const periodOptions: ChipOption<GoalPeriod>[] = GOAL_PERIODS.map((value) => ({
    value,
    label: de.create.periodLabel[value],
  }));
  const stakeOptions: ChipOption<number>[] = STAKE_PRESETS_CENTS.map((cents) => ({
    value: cents,
    label: formatAmount(cents),
    accessibilityLabel: `${formatAmount(cents)} ${de.common.credits}`,
  }));

  const openConfirmation = () => {
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    if (
      !validDate(first) ||
      !validDate(last) ||
      first < today ||
      first > addDays(today, 30) ||
      last < first ||
      last > addDays(first, 30) ||
      (withFriends && first <= today)
    ) {
      setError(de.improvements.invalidDates);
      return;
    }

    const result = createGoalSchema.safeParse({
      title,
      goalType,
      targetValue,
      stakeCents,
      period,
      startDate: first,
      endDate: last,
      withFriends,
      donate,
      ngoId: ngoId ?? ngos.data?.[0]?.id ?? null,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? de.create.invalidInput);
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const confirm = () => {
    const result = createGoalSchema.safeParse({
      title,
      goalType,
      targetValue,
      stakeCents,
      period,
      startDate: first,
      endDate: last,
      withFriends,
      donate,
      ngoId: ngoId ?? ngos.data?.[0]?.id ?? null,
    });
    if (!result.success) {
      setError(de.create.invalidInput);
      return;
    }
    setError(null);
    create.mutate(result.data, {
      onSuccess: (challenge) => {
        setConfirming(false);
        router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id, started: '1' } });
      },
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  const stake = formatAmount(stakeCents);

  return (
    <Screen scroll edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
      <Stack.Screen options={{ title: de.create.title }} />
      <Text color="textSecondary">{de.create.intro}</Text>
      <ChipGroup
        label={de.create.goalType}
        options={goalOptions}
        value={goalType}
        onChange={(type: GoalType) => {
          setGoalType(type);
          setTargetValue(DEFAULT_TARGET[type]);
          setCustomTarget('');
        }}
      />
      <ChipGroup
        label={de.create.target}
        options={targetOptions}
        value={targetValue}
        onChange={(value) => {
          setTargetValue(value);
          setCustomTarget('');
        }}
      />
      <TextField
        label={goalType.startsWith('run') ? de.improvements.km : de.improvements.steps}
        keyboardType="decimal-pad"
        value={customTarget}
        onChangeText={(value) => {
          setCustomTarget(value);
          setTargetValue(
            Math.round(Number(value.replace(',', '.')) * (goalType.startsWith('run') ? 1000 : 1)),
          );
        }}
      />
      <ChipGroup
        label={de.create.period}
        options={periodOptions}
        value={period}
        onChange={(value) => {
          setPeriod(value);
          setStartDate('');
          setEndDate('');
        }}
      />
      <TextField label={de.improvements.startDate} value={first} onChangeText={setStartDate} />
      <TextField label={de.improvements.endDate} value={last} onChangeText={setEndDate} />
      <Text color="textMuted">{de.improvements.datesHint}</Text>
      <ChipGroup
        label={de.improvements.together}
        value={withFriends ? 'friends' : 'alone'}
        options={[
          { value: 'alone', label: de.improvements.alone },
          { value: 'friends', label: de.improvements.together },
        ]}
        onChange={(value) => setWithFriends(value === 'friends')}
      />
      {period === 'day' && first === today ? (
        <Text color="textSecondary">{de.create.todayHint}</Text>
      ) : null}
      <Text color="textSecondary">{de.create.summary(first, last)}</Text>
      <View style={styles.group}>
        <ChipGroup
          label={de.create.stake}
          options={stakeOptions}
          value={stakeCents}
          onChange={setStakeCents}
        />
        <Text variant="caption" color="textMuted">
          {de.create.stakeHint}
        </Text>
      </View>
      <ChipGroup
        label={de.donations.choice}
        options={[
          { value: 'keep', label: de.donations.keep },
          { value: 'donate', label: de.donations.donate },
        ]}
        value={donate ? 'donate' : 'keep'}
        onChange={(value) => setDonate(value === 'donate')}
      />
      {donate ? (
        <ChipGroup
          label={de.donations.ngo}
          options={(ngos.data ?? []).map((n) => ({ value: n.id, label: n.name }))}
          value={ngoId ?? ngos.data?.[0]?.id ?? ''}
          onChange={setNgoId}
        />
      ) : null}
      <Text color="textMuted">{de.coach.locked}</Text>
      <View style={styles.group}>
        {error && !confirming ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button label={de.create.submit} onPress={openConfirmation} />
      </View>

      <Sheet
        visible={confirming}
        title={de.create.confirmTitle}
        onClose={() => {
          setConfirming(false);
          create.reset();
          setError(null);
        }}
        closeLabel={de.create.confirmCancel}
      >
        <Text>{de.create.confirmGoal(describeGoal(goalType, targetValue), label)}</Text>
        <Text>{de.create.confirmStake(stake)}</Text>
        <Text color="textSecondary">{de.coach.winReturn}</Text>
        <Text color="textSecondary">{de.coach.cutoff}</Text>
        <Text color="textSecondary">{de.create.confirmMissed}</Text>
        <Text color="accent">{de.create.confirmBound(first, first === today)}</Text>
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
        <View style={styles.group}>
          <Button
            label={de.create.confirmSubmit(stake)}
            onPress={confirm}
            loading={create.isPending}
          />
          <Button
            label={de.create.confirmCancel}
            variant="secondary"
            onPress={() => {
              setConfirming(false);
              create.reset();
              setError(null);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
});
