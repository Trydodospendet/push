import { IntroPager } from '@/features/intro/intro-pager';
import { useQueryClient } from '@tanstack/react-query';
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
import { PLANS, planById, type PlanId } from '@/features/training/plans';
import { de } from '@/i18n/de';
import { daysBetween, formatDayLabel, toLocalDate } from '@/lib/dates';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Pick a plan (e.g. "In 8 Wochen zu 5 km") or follow the active one week by week. */
export default function TrainingScreen() {
  const queryClient = useQueryClient();
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
    setPlan.mutate({ planId, startDate: today }, { onSuccess: () => setCelebrate(true) });
  };

  if (!active.isPending && !active.isError && !active.data && slide < de.improvements.slides.length)
    return <IntroPager training onFinish={() => setSlide(de.improvements.slides.length)} />;
  return (
    <Screen
      scroll
      edges={SCREEN_EDGES}
      contentStyle={styles.content}
      onRefresh={() => queryClient.invalidateQueries()}
    >
      <Stack.Screen options={{ title: de.training.title }} />
      {active.isPending ? (
        <LoadingState />
      ) : active.isError ? (
        <ErrorState message={de.training.error} onRetry={() => void active.refetch()} />
      ) : active.data ? (
        <ActivePlanView
          planId={active.data.planId}
          startDate={active.data.startDate}
          sessions={sessions}
          isStarting={setPlan.isPending}
          onStartToday={start}
          onStop={() => setConfirmStop(true)}
        />
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
  startDate,
  sessions,
  isStarting,
  onStartToday,
  onStop,
}: {
  planId: PlanId;
  startDate: string;
  sessions: ReturnType<typeof useTrainingSessions>;
  isStarting: boolean;
  onStartToday: (planId: PlanId) => void;
  onStop: () => void;
}) {
  const template = planById(planId);
  if (!template) {
    return null;
  }
  const today = toLocalDate(new Date(), DEFAULT_TIMEZONE);
  const list = sessions.sessions;
  const doneCount = list?.filter((entry) => entry.done).length ?? 0;
  const elapsedDays = daysBetween(startDate, today);
  const currentWeek = Math.min(template.weeks, 1 + Math.floor(Math.max(0, elapsedDays) / 7));
  const finished = elapsedDays >= template.weeks * 7;

  return (
    <FadeIn style={styles.section}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.training.activeLabel}
      </Text>
      <Card style={styles.card}>
        <Text variant="heading">{de.training.plans[planId].name}</Text>
        {elapsedDays < 0 ? (
          <>
            <Text color="textSecondary">{de.training.startsOn(formatDayLabel(startDate))}</Text>
            <Button
              label={de.training.start}
              loading={isStarting}
              onPress={() => onStartToday(planId)}
            />
          </>
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
