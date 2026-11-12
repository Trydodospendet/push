import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, Screen, Text, TextField, type ChipOption } from '@/components';
import {
  DEFAULT_TIMEZONE,
  DURATION_PRESETS_DAYS,
  GOAL_TYPES,
  STAKE_PRESETS_CENTS,
  START_PRESET_DAYS_AHEAD,
  TARGET_PRESETS,
  type GoalType,
} from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useCreateChallenge } from '@/features/challenges/api';
import { formatTarget, suggestTitle } from '@/features/challenges/format';
import { createChallengeSchema, lastDayOf } from '@/features/challenges/schemas';
import { de } from '@/i18n/de';
import { addDays, formatDayLabel, toLocalDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { spacing } from '@/theme';

const DEFAULT_TARGET: Record<GoalType, number> = {
  run_single: 5_000,
  run_total: 10_000,
  steps_daily: 10_000,
};

function startLabel(daysAhead: number, date: string): string {
  if (daysAhead === 1) {
    return de.create.tomorrow;
  }
  if (daysAhead === 2) {
    return de.create.dayAfterTomorrow;
  }
  return formatDayLabel(date);
}

export default function CreateChallengeScreen() {
  const router = useRouter();
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const create = useCreateChallenge();

  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;
  const today = toLocalDate(new Date(), timezone);

  const [goalType, setGoalType] = useState<GoalType>('run_single');
  const [targetValue, setTargetValue] = useState(DEFAULT_TARGET.run_single);
  const [daysAhead, setDaysAhead] = useState<number>(START_PRESET_DAYS_AHEAD[0]);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [stakeCents, setStakeCents] = useState<number>(1_000);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  // null = use the suggested title, which follows the chosen goal.
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startDate = addDays(today, daysAhead);
  const title = customTitle ?? suggestTitle(goalType, targetValue);

  const goalOptions: ChipOption<GoalType>[] = GOAL_TYPES.map((type) => ({
    value: type,
    label: de.goal.typeLabel[type],
  }));
  const targetOptions: ChipOption<number>[] = TARGET_PRESETS[goalType].map((value) => ({
    value,
    label: formatTarget(goalType, value),
  }));
  const startOptions: ChipOption<number>[] = START_PRESET_DAYS_AHEAD.map((days) => {
    const date = addDays(today, days);
    return { value: days, label: startLabel(days, date), accessibilityLabel: formatDayLabel(date) };
  });
  const durationOptions: ChipOption<number>[] = DURATION_PRESETS_DAYS.map((days) => ({
    value: days,
    label: de.create.days(days),
  }));
  const stakeOptions: ChipOption<number>[] = STAKE_PRESETS_CENTS.map((cents) => ({
    value: cents,
    label: formatAmount(cents),
    accessibilityLabel: `${formatAmount(cents)} ${de.common.credits}`,
  }));
  const visibilityOptions: ChipOption<'public' | 'private'>[] = [
    { value: 'public', label: de.create.public },
    { value: 'private', label: de.create.private },
  ];

  const handleGoalType = (type: GoalType) => {
    setGoalType(type);
    setTargetValue(DEFAULT_TARGET[type]);
  };

  const handleSubmit = () => {
    const result = createChallengeSchema(today).safeParse({
      title,
      goalType,
      targetValue,
      stakeCents,
      startDate,
      durationDays,
      visibility,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? de.create.invalidInput);
      return;
    }
    setError(null);
    create.mutate(result.data, {
      onSuccess: (challenge) =>
        router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id } }),
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  return (
    <Screen scroll edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
      <ChipGroup
        label={de.create.goalType}
        options={goalOptions}
        value={goalType}
        onChange={handleGoalType}
      />
      <ChipGroup
        label={de.create.target}
        options={targetOptions}
        value={targetValue}
        onChange={setTargetValue}
      />
      <ChipGroup
        label={de.create.start}
        options={startOptions}
        value={daysAhead}
        onChange={setDaysAhead}
      />
      <ChipGroup
        label={de.create.duration}
        options={durationOptions}
        value={durationDays}
        onChange={setDurationDays}
      />
      <Text color="textSecondary">
        {de.create.summary(
          formatDayLabel(startDate),
          formatDayLabel(lastDayOf(startDate, durationDays)),
        )}
      </Text>
      <ChipGroup
        label={de.create.stake}
        options={stakeOptions}
        value={stakeCents}
        onChange={setStakeCents}
      />
      <View style={styles.group}>
        <ChipGroup
          label={de.create.visibility}
          options={visibilityOptions}
          value={visibility}
          onChange={setVisibility}
        />
        <Text variant="caption" color="textMuted">
          {visibility === 'public' ? de.create.publicHint : de.create.privateHint}
        </Text>
      </View>
      <TextField
        label={de.create.titleLabel}
        hint={de.create.titleHint}
        value={title}
        onChangeText={setCustomTitle}
        maxLength={80}
        returnKeyType="done"
      />
      <View style={styles.group}>
        {error ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {de.create.afterCreateHint}
        </Text>
        <Button label={de.create.submit} onPress={handleSubmit} loading={create.isPending} />
      </View>
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
    gap: spacing.xs,
  },
});
