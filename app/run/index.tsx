import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, DraggablePanel, FadeIn, Sheet, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useMyRecords } from '@/features/gps/analytics-api';
import { useGpsRunRoute, useMyGpsRuns } from '@/features/gps/api';
import { maybeAskForReview } from '@/features/review/review';
import { formatClock, formatKm, formatPace } from '@/features/gps/format';
import { liveSplits, paceSecondsPerKm } from '@/features/gps/geo';
import { useGps, type StartOutcome } from '@/features/gps/gps-provider';
import { PeriodCard } from '@/features/gps/period-card';
import { liveStats } from '@/features/gps/recorder';
import { RecordsCard } from '@/features/gps/records-card';
import { RouteMap } from '@/features/gps/route-map';
import { RunList } from '@/features/gps/run-list';
import { useClock } from '@/features/gps/use-clock';
import { useKilometerAnnouncements } from '@/features/gps/voice';
import { usePreferences } from '@/features/preferences/store';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

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
  const { height } = useWindowDimensions();
  return (
    <RouteMap
      points={route.data ?? []}
      mode="fit"
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
    case 'error':
      return de.run.startError;
    case 'started':
      return null;
  }
}

function IdleRun({ timezone }: { timezone: string }) {
  const gps = useGps();
  const session = useSession();
  const { height } = useWindowDimensions();
  const [starting, setStarting] = useState(false);
  const [outcome, setOutcome] = useState<StartOutcome | null>(null);
  const message = outcome === null ? null : startMessage(outcome);

  return (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{ paddingTop: Math.round(height * 0.4) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sheet}>
        <FadeIn style={styles.sheetSection}>
          <Button
            label={de.run.start}
            loading={starting}
            disabled={gps.recovered !== null}
            onPress={() => {
              setStarting(true);
              void gps
                .start()
                .then(setOutcome)
                .finally(() => setStarting(false));
            }}
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
          <Button
            label={de.battery.link}
            variant="secondary"
            onPress={() => router.push('/battery')}
          />
        </FadeIn>
        <FadeIn delayMs={100}>
          <PeriodCard userId={session.user.id} />
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
  const now = useClock(!paused);

  const stats = liveStats(recorder.points);
  const splits = liveSplits(recorder.points);
  const lastSplit = splits[splits.length - 1];
  const last = recorder.points[recorder.points.length - 1];
  // Between two GPS points the clock keeps running (up to 10 s, then the signal is lost).
  const sinceLast = !paused && last ? Math.min(10, Math.max(0, (now - last.t) / 1000)) : 0;
  const elapsed = stats.elapsedS + sinceLast;
  const pace = paceSecondsPerKm(stats.distanceM, stats.elapsedS);
  const { voice } = usePreferences();
  useKilometerAnnouncements(recorder.points, stats.elapsedS, voice && !paused);

  const act = (task: () => Promise<unknown>) => {
    setBusy(true);
    void task().finally(() => setBusy(false));
  };

  return (
    <>
      <DraggablePanel
        toggleLabel={de.runStats.panelToggle}
        onHeight={onInset}
        header={
          <View style={styles.headerNumbers}>
            <Text
              variant="label"
              color={paused ? 'textSecondary' : 'accent'}
              align="center"
              accessibilityLiveRegion="polite"
            >
              {paused
                ? de.run.paused
                : recorder.points.length === 0
                  ? de.run.accuracyWaiting
                  : de.run.recording}
            </Text>
            <Text
              variant="display"
              align="center"
              style={styles.number}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {formatClock(elapsed)}
            </Text>
          </View>
        }
      >
        <View style={styles.statRow}>
          <Stat label={de.run.distance} value={formatKm(stats.distanceM)} />
          <Stat label={de.run.pace} value={formatPace(pace)} />
        </View>
        {lastSplit ? (
          <Stat
            label={`${de.runStats.lastKm} (${lastSplit.km})`}
            value={formatPace(lastSplit.seconds)}
          />
        ) : null}
        {recorder.full ? (
          <Text color="danger" accessibilityRole="alert">
            {de.run.full}
          </Text>
        ) : null}
        <Button
          label={paused ? de.run.resume : de.run.pause}
          loading={busy}
          onPress={() => act(paused ? gps.resume : gps.pause)}
        />
        <Button
          label={de.run.stop}
          variant="danger"
          disabled={busy}
          onPress={() => setStopOpen(true)}
        />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="label" color="textSecondary" align="center">
        {label}
      </Text>
      <Text variant="title" align="center" style={styles.number}>
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
  headerNumbers: {
    gap: spacing.xxs,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    gap: spacing.xxs,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
