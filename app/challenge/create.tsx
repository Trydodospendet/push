import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, Screen, Sheet, Text, type ChipOption } from '@/components';
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
  const balance = useWalletBalance(session.user.id);
  const create = useCreateGoal();

  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;
  const today = toLocalDate(new Date(), timezone);

  const [goalType, setGoalType] = useState<GoalType>('run_total');
  const [targetValue, setTargetValue] = useState(DEFAULT_TARGET.run_total);
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [stakeCents, setStakeCents] = useState<number>(1_000);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { first, last } = goalPeriodDays(today, period);
  const label = periodLabel(period, first, last);
  const title = `${suggestTitle(goalType, targetValue)} · ${label}`;
  // The settlement follows 24 hours after the period ended (time to synchronise).
  const settlementDay = addDays(last, 2);

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
    const result = createGoalSchema.safeParse({ title, goalType, targetValue, stakeCents, period });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? de.create.invalidInput);
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const confirm = () => {
    const result = createGoalSchema.safeParse({ title, goalType, targetValue, stakeCents, period });
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
        }}
      />
      <ChipGroup
        label={de.create.target}
        options={targetOptions}
        value={targetValue}
        onChange={setTargetValue}
      />
      <ChipGroup
        label={de.create.period}
        options={periodOptions}
        value={period}
        onChange={setPeriod}
      />
      {period === 'day' ? <Text color="textSecondary">{de.create.todayHint}</Text> : null}
      <Text color="textSecondary">
        {de.create.summary(formatDayLabel(first), formatDayLabel(last))}
      </Text>
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
        <Text color="textSecondary">{de.create.confirmReturn(formatDayLabel(settlementDay))}</Text>
        <Text color="textSecondary">{de.create.confirmMissed}</Text>
        <Text color="accent">
          {de.create.confirmBound(formatDayLabel(first), period === 'day')}
        </Text>
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
