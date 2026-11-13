import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ErrorState,
  FadeIn,
  LoadingState,
  Pill,
  Screen,
  Sheet,
  Text,
} from '@/components';
import { ChallengeStartCelebration } from '@/features/challenges/challenge-start-celebration';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { formatKm } from '@/features/gps/format';
import { useActivePlan, useSetActivePlan, useTrainingSessions } from '@/features/training/api';
import { nextMonday, PLANS, planById, type PlanId } from '@/features/training/plans';
import { de } from '@/i18n/de';
import { formatDayLabel, toLocalDate } from '@/lib/dates';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Pick a plan (e.g. "In 8 Wochen zu 5 km") or follow the active one week by week. */
export default function TrainingScreen() {
  const session = useSession();
  const userId = session.user.id;
  const active = useActivePlan(userId);
  const setPlan = useSetActivePlan(userId);
  const sessions = useTrainingSessions(userId, active.data);
  const [slide, setSlide] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  const start = (planId: PlanId) => {
    const today = toLocalDate(new Date(), DEFAULT_TIMEZONE);
    setPlan.mutate(
      { planId, startMonday: nextMonday(today) },
      { onSuccess: () => setCelebrate(true) },
    );
  };

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Stack.Screen options={{ title: de.training.title }} />
      {active.isPending ? (
        <LoadingState />
      ) : active.isError ? (
        <ErrorState message={de.training.error} onRetry={() => void active.refetch()} />
      ) : active.data ? (
        <ActivePlanView
          planId={active.data.planId}
          startMonday={active.data.startMonday}
          sessions={sessions}
          onStop={() => setConfirmStop(true)}
        />
      ) : slide < de.improvements.slides.length ? (
        <Card style={styles.card}>
          <Text variant="heading">{`${slide + 1} / ${de.improvements.slides.length}`}</Text>
          <Text>{de.improvements.slides[slide]}</Text>
          <Button
            label={
              slide === de.improvements.slides.length - 1
                ? de.improvements.choose
                : de.improvements.next
            }
            onPress={() => setSlide(slide + 1)}
          />
        </Card>
      ) : (
        <FadeIn style={styles.section}>
          <Text color="textSecondary">{de.training.intro}</Text>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.training.plansLabel}
          </Text>
          {PLANS.map((plan) => (
            <Card key={plan.id} style={styles.card}>
              <View style={styles.row}>
                <Text variant="heading">{de.training.plans[plan.id].name}</Text>
                <Pill label={de.training.weeks(plan.weeks)} />
              </View>
              <Text color="textSecondary">{de.training.plans[plan.id].text}</Text>
              <Button
                label={de.training.start}
                loading={setPlan.isPending}
                onPress={() => start(plan.id)}
              />
            </Card>
          ))}
          <Text variant="caption" color="textMuted">
            {de.training.startHint}
          </Text>
        </FadeIn>
      )}

      <ChallengeStartCelebration
        visible={celebrate}
        onClose={() => setCelebrate(false)}
        title={de.improvements.trainingTitle}
        message={de.improvements.trainingQuote}
      />
      {setPlan.isError ? <ErrorState message={de.training.error} /> : null}
      <Sheet
        visible={confirmStop}
        title={de.training.stopTitle}
        closeLabel={de.training.cancel}
        onClose={() => setConfirmStop(false)}
      >
        <Text color="textSecondary">{de.training.stopText}</Text>
        <Button
          label={de.training.stopConfirm}
          onPress={() => {
            setConfirmStop(false);
            setPlan.mutate(null);
          }}
        />
        <Button
          label={de.training.cancel}
          variant="secondary"
          onPress={() => setConfirmStop(false)}
        />
      </Sheet>
    </Screen>
  );
}

function ActivePlanView({
  planId,
  startMonday,
  sessions,
  onStop,
}: {
  planId: PlanId;
  startMonday: string;
  sessions: ReturnType<typeof useTrainingSessions>;
  onStop: () => void;
}) {
  const template = planById(planId);
  if (!template) {
    return null;
  }
  const today = toLocalDate(new Date(), DEFAULT_TIMEZONE);
  const list = sessions.sessions;
  const doneCount = list?.filter((entry) => entry.done).length ?? 0;
  const currentWeek = list?.find((entry) => entry.date >= today)?.week ?? template.weeks;
  const finished = list !== undefined && list.every((entry) => entry.date < today);

  return (
    <FadeIn style={styles.section}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.training.activeLabel}
      </Text>
      <Card style={styles.card}>
        <Text variant="heading">{de.training.plans[planId].name}</Text>
        {today < startMonday ? (
          <Text color="textSecondary">{de.training.startsOn(formatDayLabel(startMonday))}</Text>
        ) : (
          <Text color="textSecondary">{de.training.week(currentWeek, template.weeks)}</Text>
        )}
        {list ? <Text color="accent">{de.training.summary(doneCount, list.length)}</Text> : null}
        {finished ? <Text>{de.training.finished}</Text> : null}
      </Card>

      {sessions.isPending ? (
        <LoadingState />
      ) : sessions.isError ? (
        <ErrorState message={de.training.error} onRetry={() => void sessions.refetch()} />
      ) : (
        list
          ?.filter((entry) => entry.week >= currentWeek - 1 && entry.week <= currentWeek + 1)
          .map((entry) => (
            <Card key={entry.date} style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text variant="heading">{`${formatKm(entry.distanceM)} km`}</Text>
                  <Text color="textSecondary">
                    {`${formatDayLabel(entry.date)} · ${entry.kind === 'long' ? de.training.long : de.training.easy}`}
                  </Text>
                </View>
                <Pill
                  label={entry.done ? de.training.done : de.training.open}
                  tone={entry.done ? 'accent' : 'neutral'}
                />
              </View>
            </Card>
          ))
      )}
      <Button label={de.training.stop} variant="secondary" onPress={onStop} />
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  section: { gap: spacing.sm },
  card: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
