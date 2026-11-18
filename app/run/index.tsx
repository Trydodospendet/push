import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, DraggablePanel, FadeIn, ProgressBar, Sheet, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyChallenges } from '@/features/challenges/api';
import { useMyProgress } from '@/features/health/api';
import { pickPrimaryChallenge, progressNumbers, progressRatio } from '@/features/health/progress';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useMyRecords } from '@/features/gps/analytics-api';
import { useGpsRunRoute, useMyGpsRuns } from '@/features/gps/api';
import { maybeAskForReview } from '@/features/review/review';
import { formatClock, formatKm, formatPace } from '@/features/gps/format';
import { liveSpeedKmh, liveSplits, paceSecondsPerKm } from '@/features/gps/geo';
import { useGps, type StartOutcome } from '@/features/gps/gps-provider';
import { PeriodCard } from '@/features/gps/period-card';
import { liveStats } from '@/features/gps/recorder';
import { RecordsCard } from '@/features/gps/records-card';
import { RouteMap } from '@/features/gps/route-map';
import { RunList } from '@/features/gps/run-list';
import { useClock } from '@/features/gps/use-clock';
import { useCurrentPosition } from '@/features/gps/use-current-position';
import { useKilometerAnnouncements } from '@/features/gps/voice';
import { hapticSelect, hapticSuccess } from '@/features/preferences/haptics';
import { usePreferences } from '@/features/preferences/store';
import { FurNumber } from '@/features/fur/fur-number';
import { isGoalType } from '@/features/challenges/format';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

const IDLE_ZOOM = 15;

const speedFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/**
 * Record a run with GPS. The map is the background of the whole screen: before the run it shows
 * the last route with the explanation, history and statistics on top; during the run it follows
 * the runner, with the big numbers in a panel that can be pulled down.
 */
export default function RunScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const gps = useGps();
  const { recorder } = gps;
  const active = recorder.status === 'recording' || recorder.status === 'paused';
  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;
  const [inset, setInset] = useState(0);

  return (
    <View style={styles.root}>
      {active ? <LiveBackground inset={inset} /> : <LastRunBackground />}
      {gps.recovered ? <RecoveredNotice /> : null}
      {active ? <ActiveRun onInset={setInset} /> : <IdleRun timezone={timezone} />}
      <ResultSheet />
    </View>
  );
}

/** The map follows the runner; the panel's height is kept free at the bottom. */
function LiveBackground({ inset }: { inset: number }) {
  const { recorder } = useGps();
  return <RouteMap points={recorder.points} mode="follow" bottomInset={inset} />;
}

function LastRunBackground() {
  const session = useSession();
  const runs = useMyGpsRuns(session.user.id);
  const latest = runs.data?.find((run) => run.hasRoute);
  const route = useGpsRunRoute(latest?.id ?? '', latest !== undefined);
  const position = useCurrentPosition();
  const { height } = useWindowDimensions();
  return (
    <RouteMap
      points={position ? [] : (route.data ?? [])}
      mode={position ? 'follow' : 'fit'}
      position={position}
      zoom={IDLE_ZOOM}
      animate
      bottomInset={Math.round(height * 0.55)}
    />
  );
}

function RecoveredNotice() {
  const gps = useGps();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  if (!gps.recovered) {
    return null;
  }
  const run = (task: () => Promise<void>) => {
    setBusy(true);
    void task().finally(() => setBusy(false));
  };
  return (
    <View style={[styles.notice, { top: insets.top + 56 }]}>
      <Card style={styles.noticeCard}>
        <Text variant="heading">{de.run.recoveredTitle}</Text>
        <Text color="textSecondary">{de.run.recoveredText(String(gps.recovered.pointCount))}</Text>
        <Button
          label={de.run.recoveredContinue}
          loading={busy}
          onPress={() => run(gps.continueRecovered)}
        />
        <Button
          label={de.run.discard}
          variant="secondary"
          disabled={busy}
          onPress={() => run(gps.discardRecovered)}
        />
      </Card>
    </View>
  );
}

function startMessage(outcome: StartOutcome): string | null {
  switch (outcome) {
    case 'denied':
      return de.run.permissionDenied;
    case 'blocked':
      return de.run.permissionBlocked;
    case 'servicesDisabled':
      return de.run.servicesDisabled;
    case 'error':
      return de.run.startError;
    case 'started':
      return null;
  }
}

function IdleRun({ timezone }: { timezone: string }) {
  const gps = useGps();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [outcome, setOutcome] = useState<StartOutcome | null>(null);
  const message = outcome === null ? null : startMessage(outcome);
  const startRun = () => {
    setStarting(true);
    void gps
      .start()
      .then(setOutcome)
      .finally(() => setStarting(false));
  };

  return (
    <ScrollView
      style={StyleSheet.absoluteFill}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            hapticSelect();
            setRefreshing(true);
            void queryClient.invalidateQueries().finally(() => setRefreshing(false));
          }}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <View style={styles.mapStage} />
      <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
        <FadeIn style={styles.sheetSection}>
          <Button
            label={de.run.start}
            loading={starting}
            disabled={gps.recovered !== null}
            onPress={startRun}
          />
          {message ? (
            <Text color="danger" accessibilityRole="alert">
              {message}
            </Text>
          ) : null}
          {outcome === 'blocked' ? (
            <Button
              label={de.run.openSettings}
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </FadeIn>
        <FadeIn delayMs={60}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={de.battery.link}
            onPress={() => router.push('/battery')}
            style={styles.textLink}
          >
            <Text variant="caption" color="accent" align="center">
              {de.battery.link}
            </Text>
          </Pressable>
        </FadeIn>
        <FadeIn delayMs={100}>
          <PeriodCard userId={session.user.id} onStart={startRun} />
        </FadeIn>
        <FadeIn delayMs={160}>
          <RecordsCard userId={session.user.id} />
        </FadeIn>
        <FadeIn delayMs={220} style={styles.sheetSection}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.run.historyLabel}
          </Text>
          <RunList timezone={timezone} />
        </FadeIn>
        <Card style={styles.explain}>
          <Text variant="label" color="textSecondary">
            {de.run.explainTitle}
          </Text>
          {de.run.explain.map((line) => (
            <Text key={line} variant="caption" color="textSecondary">
              {`• ${line}`}
            </Text>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}

function ActiveRun({ onInset }: { onInset: (height: number) => void }) {
  const gps = useGps();
  const { recorder } = gps;
  const paused = recorder.status === 'paused';
  const [stopOpen, setStopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const now = useClock(!paused);

  const stats = liveStats(recorder.points);
  const splits = liveSplits(recorder.points);
  const lastSplit = splits[splits.length - 1];
  const last = recorder.points.at(-1);
  const hasCurrentFix = last?.segment === recorder.segment;
  // Between two GPS points the clock keeps running (up to 10 s, then the signal is lost).
  const sinceLast = !paused && hasCurrentFix ? Math.min(10, Math.max(0, (now - last.t) / 1000)) : 0;
  const elapsed = stats.elapsedS + sinceLast;
  const pace = paceSecondsPerKm(stats.distanceM, stats.elapsedS);
  const currentSpeed = paused ? 0 : liveSpeedKmh(recorder.points, now);
  const speedText = currentSpeed === null ? '–' : speedFormat.format(currentSpeed);
  const { voice } = usePreferences();
  useKilometerAnnouncements(recorder.points, stats.elapsedS, voice && !paused);

  const act = (task: () => Promise<unknown>) => {
    setBusy(true);
    setControlError(null);
    void task()
      .catch(() => setControlError(paused ? de.run.resumeError : de.run.pauseError))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <DraggablePanel
        toggleLabel={de.runStats.panelToggle}
        maxShare={0.7}
        onHeight={onInset}
        header={
          <View style={styles.headerNumbers}>
            <Text
              variant="label"
              color={paused ? 'textSecondary' : 'accent'}
              align="center"
              accessibilityLiveRegion="polite"
            >
              {paused ? de.run.paused : !hasCurrentFix ? de.run.accuracyWaiting : de.run.recording}
            </Text>
            <FurNumber value={formatKm(stats.distanceM)} unit="km" height={80} maxWidth={300} />
            <View style={styles.statCard}>
              <Stat label={de.run.statTime} value={formatClock(elapsed)} />
              <Stat label={de.run.statPace} value={formatPace(pace)} divided />
              <Stat label={de.run.statSpeed} value={speedText} divided />
            </View>
            <GoalLine liveDistanceM={stats.distanceM} />
          </View>
        }
      >
        {lastSplit ? (
          <Text variant="caption" color="textSecondary" align="center">
            {`${de.runStats.lastKm} (${lastSplit.km}): ${formatPace(lastSplit.seconds)}`}
          </Text>
        ) : null}
        {recorder.full ? (
          <Text color="danger" accessibilityRole="alert">
            {de.run.full}
          </Text>
        ) : null}
        {controlError ? (
          <Text color="danger" accessibilityRole="alert">
            {controlError}
          </Text>
        ) : null}
        <View style={styles.controls}>
          <View style={styles.control}>
            <Button
              label={paused ? de.run.resume : de.run.pause}
              variant="secondary"
              loading={busy}
              onPress={() => act(paused ? gps.resume : gps.pause)}
            />
          </View>
          <View style={styles.control}>
            <Button label={de.run.stop} disabled={busy} onPress={() => setStopOpen(true)} />
          </View>
        </View>
      </DraggablePanel>
      <Sheet
        visible={stopOpen}
        title={de.run.stopTitle}
        onClose={() => setStopOpen(false)}
        closeLabel={de.run.keepRunning}
      >
        <Button
          label={de.run.save}
          loading={busy}
          onPress={() => {
            setBusy(true);
            void gps.stop().finally(() => {
              hapticSuccess();
              setBusy(false);
              setStopOpen(false);
            });
          }}
        />
        <Button
          label={de.run.keepRunning}
          variant="secondary"
          disabled={busy}
          onPress={() => setStopOpen(false)}
        />
        <Button
          label={de.run.discard}
          variant="danger"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void gps.discard().finally(() => {
              setBusy(false);
              setStopOpen(false);
            });
          }}
        />
      </Sheet>
    </>
  );
}

/** Goal of the active run challenge with the live distance of this run added on top. */
function GoalLine({ liveDistanceM }: { liveDistanceM: number }) {
  const userId = useSession().user.id;
  const mine = useMyChallenges(userId);
  const progress = useMyProgress(userId);
  const now = useClock(true);
  const goal = pickPrimaryChallenge(
    (mine.data ?? []).filter(
      (challenge) =>
        challenge.isParticipant &&
        challenge.status === 'active' &&
        challenge.goal_type.startsWith('run') &&
        Date.parse(challenge.ends_at) > now,
    ),
  );
  if (!goal || !isGoalType(goal.goal_type)) {
    return null;
  }
  const saved = progress.data?.[goal.id] ?? 0;
  const value =
    goal.goal_type === 'run_single'
      ? Math.max(saved, liveDistanceM)
      : saved + Math.round(liveDistanceM);
  const ratio = progressRatio(goal.goal_type, value, goal.target_value, 1);
  const target = progressNumbers(goal.goal_type, value, goal.target_value, 1).goal;
  return (
    <View style={styles.goal}>
      <View style={styles.goalRow}>
        <Text variant="caption" color="textSecondary">
          {de.run.goalLine(target)}
        </Text>
        {ratio >= 1 ? (
          <Text variant="caption" color="accent">
            {de.run.goalReached}
          </Text>
        ) : null}
      </View>
      <ProgressBar progress={ratio} accessibilityLabel={de.run.goalBar} />
    </View>
  );
}

function Stat({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <View
      style={[styles.stat, divided && styles.statDivided]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text variant="label" color="textSecondary" align="center" style={styles.statLabel}>
        {label}
      </Text>
      <Text variant="heading" align="center" style={styles.number}>
        {value}
      </Text>
    </View>
  );
}

/** Shows the server's verdict once the run is uploaded. */
function ResultSheet() {
  const gps = useGps();
  const result = gps.lastResult;
  const session = useSession();
  const records = useMyRecords(session.user.id);
  const reason =
    result && !result.isValid && result.invalidReason
      ? (de.activities.reason as Record<string, string>)[result.invalidReason]
      : undefined;

  const dismiss = () => {
    // A record that was set by the run that has just been saved (it started in the last 12 hours).
    const newRecord =
      result?.isValid === true &&
      (records.data ?? []).some(
        (record) =>
          record.kind !== 'best_week' &&
          Date.now() - Date.parse(record.achievedAt) < 12 * 60 * 60 * 1000,
      );
    gps.dismissResult();
    if (newRecord) {
      void maybeAskForReview('record');
    }
  };

  return (
    <Sheet
      visible={result !== null}
      title={de.run.resultTitle}
      onClose={dismiss}
      closeLabel={de.run.done}
    >
      {result ? (
        <>
          <Text variant="heading">
            {de.run.runLine(formatKm(result.distanceM), formatClock(result.durationS))}
          </Text>
          <Text color={result.isValid ? 'accent' : 'danger'}>
            {result.isValid
              ? de.run.resultCounts(formatKm(result.distanceM))
              : de.run.resultNotCounted}
          </Text>
          {reason ? <Text color="textSecondary">{reason}</Text> : null}
        </>
      ) : null}
      <Button label={de.run.done} onPress={dismiss} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheet: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    minHeight: 600,
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
    borderBottomWidth: 0,
  },
  sheetSection: {
    gap: spacing.sm,
  },
  explain: {
    gap: spacing.xs,
  },
  notice: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  noticeCard: {
    gap: spacing.sm,
  },
  goal: { gap: spacing.xs, alignSelf: 'stretch', marginTop: spacing.xs },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headerNumbers: {
    gap: spacing.xxs,
  },
  mapStage: {
    height: 300,
  },
  statCard: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stat: {
    flex: 1,
    gap: spacing.xxs,
  },
  statDivided: {
    borderLeftWidth: layout.borderWidth,
    borderLeftColor: colors.border,
  },
  statLabel: { fontSize: 11, letterSpacing: 1 },
  textLink: { minHeight: 44, justifyContent: 'center' },
  controls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  control: {
    flex: 1,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
