import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ChipGroup,
  Screen,
  Sheet,
  Text,
  TextField,
  type ChipOption,
} from '@/components';
import {
  CHALLENGE_TITLE_MAX_LENGTH,
  DEFAULT_TIMEZONE,
  GOAL_PERIODS,
  GOAL_TYPES,
  STAKE_PRESETS_CENTS,
  TARGET_LIMITS,
  TARGET_PRESETS,
  type GoalPeriod,
  type GoalType,
} from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useCreateGoal } from '@/features/challenges/api';
import { describeGoal, formatTarget, goalRule, suggestTitle } from '@/features/challenges/format';
import { createGoalSchema, goalPeriodDays } from '@/features/challenges/schemas';
import { useNgos } from '@/features/donations/api';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { addDays, formatDayLabel, toLocalDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';

const DEFAULT_TARGET: Record<GoalType, number> = {
  run_single: 5_000,
  run_total: 10_000,
  steps_daily: 10_000,
  steps_total: 70_000,
};

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

type Step = 0 | 1 | 2;

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
  const [presetTarget, setPresetTarget] = useState(DEFAULT_TARGET.run_total);
  const [editingTarget, setEditingTarget] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [customTarget, setCustomTarget] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [stakeCents, setStakeCents] = useState<number>(1_000);
  const [confirming, setConfirming] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const presetDates = goalPeriodDays(today, period);
  const [customDates, setCustomDates] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [withFriends, setWithFriends] = useState(false);
  const first = customDates ? startDate.trim() : presetDates.first;
  const last = customDates ? endDate.trim() : presetDates.last;
  const running = goalType.startsWith('run');
  const targetInput = customTarget.trim();
  const validTargetInput = running
    ? /^\d+(?:[,.]\d{1,3})?$/.test(targetInput)
    : /^\d+$/.test(targetInput);
  const targetValue = editingTarget
    ? validTargetInput
      ? Math.round(Number(targetInput.replace(',', '.')) * (running ? 1000 : 1))
      : NaN
    : presetTarget;
  const datesValid = isValidDate(first) && isValidDate(last);
  const label = datesValid ? de.create.range(formatDayLabel(first), formatDayLabel(last)) : '';
  const baseTitle = suggestTitle(goalType, targetValue);
  const titledPeriod = `${baseTitle} · ${label}`;
  const title = titledPeriod.length <= CHALLENGE_TITLE_MAX_LENGTH ? titledPeriod : baseTitle;
  const selectedNgo = ngoId ?? ngos.data?.[0]?.id ?? null;

  const goalOptions: ChipOption<GoalType>[] = GOAL_TYPES.map((type) => ({
    value: type,
    label: de.goal.typeLabel[type],
  }));
  const targetOptions: ChipOption<number | 'custom'>[] = [
    ...TARGET_PRESETS[goalType].map((value) => ({ value, label: formatTarget(goalType, value) })),
    { value: 'custom', label: de.create.customTarget },
  ];
  const periodOptions: ChipOption<GoalPeriod>[] = GOAL_PERIODS.filter(
    (value) => value !== 'day' || !withFriends,
  ).map((value) => ({
    value,
    label: de.create.periodLabel[value],
  }));
  const stakeOptions: ChipOption<number>[] = STAKE_PRESETS_CENTS.map((cents) => ({
    value: cents,
    label: formatAmount(cents),
    accessibilityLabel: `${formatAmount(cents)} ${de.common.credits}`,
  }));

  const targetError = () => {
    const { min, max } = TARGET_LIMITS[goalType];
    return !Number.isInteger(targetValue) || targetValue < min || targetValue > max
      ? de.create.invalidTarget(formatTarget(goalType, min), formatTarget(goalType, max))
      : null;
  };

  const dateError = () => {
    if (
      !datesValid ||
      first < today ||
      first > addDays(today, 30) ||
      last < first ||
      last > addDays(first, 30)
    ) {
      return de.improvements.invalidDates;
    }
    return withFriends && first === today ? de.create.friendStart : null;
  };

  const validate = () => {
    const problem =
      targetError() ??
      dateError() ??
      (balance.data !== undefined && stakeCents > balance.data
        ? de.serverErrors.insufficient_funds
        : null) ??
      (donate && !selectedNgo ? de.create.noNgo : null);
    if (problem) {
      setError(problem);
      return null;
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
      ngoId: donate ? selectedNgo : null,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? de.create.invalidInput);
      return null;
    }
    setError(null);
    return result.data;
  };

  const next = () => {
    if (step === 2) {
      if (validate()) setConfirming(true);
      return;
    }
    const problem = step === 0 ? targetError() : dateError();
    setError(problem);
    if (!problem) setStep(step === 0 ? 1 : 2);
  };

  const closeConfirmation = () => {
    if (submitting.current) return;
    setConfirming(false);
    create.reset();
    setError(null);
  };

  const confirm = () => {
    if (submitting.current) return;
    const input = validate();
    if (!input) return;
    submitting.current = true;
    create.mutate(input, {
      onSuccess: (challenge) => {
        setConfirming(false);
        router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id, started: '1' } });
      },
      onError: (mutationError) => setError(toUserMessage(mutationError)),
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  const stake = formatAmount(stakeCents);
  const stepText = de.create.steps[step];
  const audience = withFriends ? de.create.reviewFriends : de.create.reviewAlone;

  const renderError = () =>
    error ? (
      <Text color="danger" accessibilityRole="alert">
        {error}
      </Text>
    ) : null;

  return (
    <Screen key={step} scroll edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
      <Stack.Screen options={{ title: de.create.title }} />
      <View style={styles.group}>
        <Text variant="label" color="accent">
          {de.create.stepOf(step + 1, de.create.steps.length)}
        </Text>
        <View
          style={styles.steps}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {de.create.steps.map(({ short }, index) => (
            <View key={short} style={styles.step}>
              <View style={[styles.stepLine, index <= step && styles.stepActive]} />
              <Text variant="caption" color={index === step ? 'text' : 'textMuted'}>
                {short}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="title" accessibilityRole="header">
          {stepText.title}
        </Text>
        <Text color="textSecondary">{stepText.intro}</Text>
      </View>

      {step === 0 ? (
        <Card style={styles.fields}>
          <ChipGroup
            label={de.create.goalType}
            options={goalOptions}
            value={goalType}
            onChange={(type) => {
              if (type === goalType) return;
              setGoalType(type);
              setPresetTarget(DEFAULT_TARGET[type]);
              setEditingTarget(false);
              setCustomTarget('');
              setError(null);
            }}
          />
          <ChipGroup
            label={de.create.target}
            options={targetOptions}
            value={editingTarget ? 'custom' : presetTarget}
            onChange={(value) => {
              setEditingTarget(value === 'custom');
              if (value !== 'custom') setPresetTarget(value);
              setError(null);
            }}
          />
          {editingTarget ? (
            <TextField
              label={running ? de.improvements.km : de.improvements.steps}
              keyboardType={running ? 'decimal-pad' : 'number-pad'}
              value={customTarget}
              onChangeText={(value) => {
                setCustomTarget(value);
                setError(null);
              }}
            />
          ) : null}
          {!targetError() ? (
            <Text color="textSecondary">{goalRule(goalType, targetValue)}</Text>
          ) : null}
        </Card>
      ) : null}

      {step === 1 ? (
        <Card style={styles.fields}>
          <ChipGroup
            label={de.create.who}
            value={withFriends ? 'friends' : 'alone'}
            options={[
              { value: 'alone', label: de.improvements.alone },
              { value: 'friends', label: de.improvements.together },
            ]}
            onChange={(value) => {
              setWithFriends(value === 'friends');
              if (value === 'friends' && period === 'day') setPeriod('week');
              setError(null);
            }}
          />
          {withFriends ? <Text color="textSecondary">{de.create.friendsHint}</Text> : null}
          {customDates ? (
            <>
              <TextField
                label={de.improvements.startDate}
                value={startDate}
                onChangeText={setStartDate}
              />
              <TextField
                label={de.improvements.endDate}
                value={endDate}
                onChangeText={setEndDate}
              />
              <Text variant="caption" color="textSecondary">
                {de.improvements.datesHint}
              </Text>
            </>
          ) : (
            <ChipGroup
              label={de.create.period}
              options={periodOptions}
              value={period}
              onChange={(value) => {
                setPeriod(value);
                setError(null);
              }}
            />
          )}
          <Button
            label={customDates ? de.create.presetDates : de.create.customDates}
            variant="secondary"
            onPress={() => {
              if (!customDates && !startDate && !endDate) {
                setStartDate(presetDates.first);
                setEndDate(presetDates.last);
              }
              setCustomDates(!customDates);
              setError(null);
            }}
          />
          {datesValid ? <Text color="accent">{label}</Text> : null}
          {first === today && first === last ? (
            <Text color="textSecondary">
              {de.create.todayHint}
              {running ? '' : ' ' + de.create.todayStepsHint}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {step === 2 ? (
        <>
          <Card style={styles.fields}>
            <ChipGroup
              label={de.create.stake}
              options={stakeOptions}
              value={stakeCents}
              onChange={(value) => {
                setStakeCents(value);
                setError(null);
              }}
            />
            {balance.data !== undefined ? (
              <Text variant="caption" color="textSecondary">
                {de.joinSheet.balance(formatAmount(balance.data))}
              </Text>
            ) : null}
            <Text color="textSecondary">{de.create.stakeHint}</Text>
            <ChipGroup
              label={de.donations.choice}
              options={[
                { value: 'keep', label: de.donations.keep },
                { value: 'donate', label: de.donations.donate },
              ]}
              value={donate ? 'donate' : 'keep'}
              onChange={(value) => {
                setDonate(value === 'donate');
                setError(null);
              }}
            />
            {donate ? (
              <ChipGroup
                label={de.donations.ngo}
                options={(ngos.data ?? []).map((ngo) => ({ value: ngo.id, label: ngo.name }))}
                value={selectedNgo ?? ''}
                onChange={setNgoId}
              />
            ) : null}
          </Card>
          <Card style={[styles.group, styles.review]}>
            <Text variant="label" color="accent">
              {de.create.reviewTitle}
            </Text>
            <Text variant="heading">{describeGoal(goalType, targetValue)}</Text>
            <Text color="textSecondary">{label}</Text>
            <Text color="textSecondary">{audience}</Text>
          </Card>
        </>
      ) : null}

      <View style={styles.group}>
        {!confirming ? renderError() : null}
        <Button label={step === 2 ? de.create.review : de.create.submit} onPress={next} />
        {step > 0 ? (
          <Button
            label={de.create.back}
            variant="secondary"
            onPress={() => {
              setError(null);
              setStep(step === 2 ? 1 : 0);
            }}
          />
        ) : null}
      </View>

      <Sheet
        visible={confirming}
        title={de.create.confirmTitle}
        onClose={closeConfirmation}
        closeLabel={de.create.confirmCancel}
      >
        <Text variant="heading">{describeGoal(goalType, targetValue)}</Text>
        <Text color="textSecondary">
          {label} · {audience}
        </Text>
        <Text>{de.create.confirmStake(stake)}</Text>
        {donate ? (
          <Text color="textSecondary">
            {de.donations.donate} · {ngos.data?.find((ngo) => ngo.id === selectedNgo)?.name}
          </Text>
        ) : null}
        <Text color="textSecondary">{de.coach.winReturn}</Text>
        <Text color="textSecondary">{de.coach.cutoff}</Text>
        <Text color="textSecondary">{de.create.confirmMissed}</Text>
        <Text color="accent">
          {de.create.confirmBound(datesValid ? formatDayLabel(first) : first, first === today)}
        </Text>
        <Text variant="caption" color="textMuted">
          {de.common.virtualCreditsNotice}
        </Text>
        {renderError()}
        <Button
          label={de.create.confirmSubmit(stake)}
          onPress={confirm}
          loading={create.isPending}
        />
        <Button
          label={de.create.change}
          variant="secondary"
          disabled={create.isPending}
          onPress={closeConfirmation}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  group: { gap: spacing.sm },
  fields: { gap: spacing.lg },
  steps: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  step: { flexGrow: 1, gap: spacing.xs },
  stepLine: { height: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.border },
  stepActive: { backgroundColor: colors.accent },
  review: { backgroundColor: colors.surfaceRaised },
});
