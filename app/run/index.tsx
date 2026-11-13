import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Sheet, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { formatClock, formatKm, formatPace } from '@/features/gps/format';
import { paceSecondsPerKm } from '@/features/gps/geo';
import { useGps, type StartOutcome } from '@/features/gps/gps-provider';
import { liveStats } from '@/features/gps/recorder';
import { RouteMap } from '@/features/gps/route-map';
import { RunList } from '@/features/gps/run-list';
import { useClock } from '@/features/gps/use-clock';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Record a run with GPS: explanation first, then start / pause / stop with a live map. */
export default function RunScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const gps = useGps();
  const { recorder } = gps;
  const active = recorder.status === 'recording' || recorder.status === 'paused';
  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      {gps.recovered ? <RecoveredCard /> : null}
      {active ? <ActiveRun /> : <IdleRun timezone={timezone} />}
      <ResultSheet />
    </Screen>
  );
}

function RecoveredCard() {
  const gps = useGps();
  const [busy, setBusy] = useState(false);
  if (!gps.recovered) {
    return null;
  }
  const run = (task: () => Promise<void>) => {
    setBusy(true);
    void task().finally(() => setBusy(false));
  };
  return (
    <Card style={styles.card}>
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
  const [starting, setStarting] = useState(false);
  const [outcome, setOutcome] = useState<StartOutcome | null>(null);
  const message = outcome === null ? null : startMessage(outcome);

  return (
    <>
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.run.explainTitle}
        </Text>
        {de.run.explain.map((line) => (
          <Text key={line} color="textSecondary">
            {`• ${line}`}
          </Text>
        ))}
      </Card>
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
      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.run.historyLabel}
        </Text>
        <RunList timezone={timezone} />
      </View>
    </>
  );
}

function ActiveRun() {
  const gps = useGps();
  const { recorder } = gps;
  const paused = recorder.status === 'paused';
  const [stopOpen, setStopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useClock(!paused);

  const stats = liveStats(recorder.points);
  const last = recorder.points[recorder.points.length - 1];
  // Between two GPS points the clock keeps running (up to 10 s, then the signal is lost).
  const sinceLast = !paused && last ? Math.min(10, Math.max(0, (now - last.t) / 1000)) : 0;
  const elapsed = stats.elapsedS + sinceLast;
  const pace = paceSecondsPerKm(stats.distanceM, stats.elapsedS);

  const act = (task: () => Promise<unknown>) => {
    setBusy(true);
    void task().finally(() => setBusy(false));
  };

  return (
    <>
      <RouteMap points={recorder.points} mode="follow" height={260} />
      <Text variant="label" color={paused ? 'textSecondary' : 'accent'} align="center">
        {paused
          ? de.run.paused
          : recorder.points.length === 0
            ? de.run.accuracyWaiting
            : de.run.recording}
      </Text>
      <View style={styles.stats}>
        <Stat label={de.run.time} value={formatClock(elapsed)} big />
        <View style={styles.statRow}>
          <Stat label={de.run.distance} value={formatKm(stats.distanceM)} />
          <Stat label={de.run.pace} value={formatPace(pace)} />
        </View>
      </View>
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

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="label" color="textSecondary" align="center">
        {label}
      </Text>
      <Text variant={big ? 'display' : 'title'} align="center" style={styles.number}>
        {value}
      </Text>
    </View>
  );
}

/** Shows the server's verdict once the run is uploaded. */
function ResultSheet() {
  const gps = useGps();
  const result = gps.lastResult;
  const reason =
    result && !result.isValid && result.invalidReason
      ? (de.activities.reason as Record<string, string>)[result.invalidReason]
      : undefined;

  return (
    <Sheet
      visible={result !== null}
      title={de.run.resultTitle}
      onClose={gps.dismissResult}
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
      <Button label={de.run.done} onPress={gps.dismissResult} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stats: {
    gap: spacing.md,
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
