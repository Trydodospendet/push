import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { badgeKeys } from '@/features/badges/api';
import { challengeKeys } from '@/features/challenges/api';
import { feedKeys } from '@/features/feed/api';
import { activityKeys } from '@/features/health/api';
import { statsKeys } from '@/features/stats/api';

import { gpsKeys } from './api';
import type { RecorderState } from './recorder';
import {
  clearRun,
  getRecorderState,
  pauseRun,
  requestLocationPermission,
  restoreRun,
  resumeRun,
  setRecorderUser,
  startRun,
  stopLocationUpdates,
  stopRun,
  subscribeRecorder,
} from './recording-service';
import { clearActiveRun, enqueueRun, loadActiveRun } from './storage';
import { uploadQueuedRuns, type UploadedRun } from './upload';

export type StartOutcome = 'started' | 'denied' | 'blocked' | 'error';

export type StopOutcome =
  /** The run was too short and thrown away. */
  | 'discarded'
  /** Uploaded; see `lastResult`. */
  | 'uploaded'
  /** Saved on the phone; it is uploaded when the connection is back. */
  | 'queued';

type GpsContextValue = {
  recorder: RecorderState;
  /** An interrupted run found on the phone (app was closed or crashed while recording). */
  recovered: { runId: string; pointCount: number } | null;
  lastResult: UploadedRun | null;
  start: () => Promise<StartOutcome>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the run and saves it (queue + upload). */
  stop: () => Promise<StopOutcome>;
  /** Ends the run without saving anything. */
  discard: () => Promise<void>;
  continueRecovered: () => Promise<void>;
  discardRecovered: () => Promise<void>;
  dismissResult: () => void;
};

const GpsContext = createContext<GpsContextValue | null>(null);

/** Uploads the queued runs and refreshes everything a new run can change. */
async function flushQueue(userId: string, queryClient: QueryClient): Promise<UploadedRun[]> {
  const uploaded = await uploadQueuedRuns(userId);
  if (uploaded.length > 0) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gpsKeys.all }),
      queryClient.invalidateQueries({ queryKey: challengeKeys.all }),
      queryClient.invalidateQueries({ queryKey: activityKeys.all }),
      queryClient.invalidateQueries({ queryKey: statsKeys.all }),
      queryClient.invalidateQueries({ queryKey: feedKeys.all }),
      queryClient.invalidateQueries({ queryKey: badgeKeys.all }),
    ]);
  }
  return uploaded;
}

export function GpsProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const recorder = useSyncExternalStore(subscribeRecorder, getRecorderState);
  const [found, setFound] = useState<{
    userId: string;
    runId: string;
    pointCount: number;
  } | null>(null);
  // A run found for another account is not offered to this one.
  const recovered = useMemo(
    () =>
      found !== null && found.userId === userId
        ? { runId: found.runId, pointCount: found.pointCount }
        : null,
    [found, userId],
  );
  const [lastResult, setLastResult] = useState<UploadedRun | null>(null);

  useEffect(() => {
    setRecorderUser(userId);
    if (userId === null) {
      return;
    }
    let cancelled = false;
    void loadActiveRun(userId).then((stored) => {
      if (!cancelled && stored && getRecorderState().status === 'idle') {
        setFound({ userId, runId: stored.runId, pointCount: stored.points.length });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const report = useCallback((uploaded: UploadedRun[]) => {
    if (uploaded.length > 0) {
      setLastResult(uploaded[uploaded.length - 1]);
    }
  }, []);

  const flush = useCallback(async (): Promise<UploadedRun[]> => {
    if (userId === null) {
      return [];
    }
    const uploaded = await flushQueue(userId, queryClient);
    report(uploaded);
    return uploaded;
  }, [queryClient, report, userId]);

  // Runs waiting for a connection are retried at app start and whenever the app returns.
  useEffect(() => {
    if (userId === null) {
      return;
    }
    void flushQueue(userId, queryClient).then(report);
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        void flushQueue(userId, queryClient).then(report);
      }
    });
    return () => subscription.remove();
  }, [queryClient, report, userId]);

  const start = useCallback(async (): Promise<StartOutcome> => {
    const permission = await requestLocationPermission();
    if (permission !== 'granted') {
      return permission;
    }
    try {
      await startRun();
      return 'started';
    } catch {
      return 'error';
    }
  }, []);

  const stop = useCallback(async (): Promise<StopOutcome> => {
    const finished = await stopRun();
    if (!finished || userId === null) {
      await clearRun();
      return 'discarded';
    }
    await enqueueRun(userId, finished.runId, finished.points);
    await clearRun();
    const uploaded = await flush();
    return uploaded.some((run) => run.runId === finished.runId) ? 'uploaded' : 'queued';
  }, [flush, userId]);

  const discard = useCallback(async () => {
    await stopRun().catch(() => null);
    await clearRun();
  }, []);

  const continueRecovered = useCallback(async () => {
    if (userId === null) {
      return;
    }
    const stored = await loadActiveRun(userId);
    if (stored) {
      restoreRun(stored.runId, stored.points);
      await stopLocationUpdates();
    }
    setFound(null);
  }, [userId]);

  const discardRecovered = useCallback(async () => {
    if (userId !== null) {
      await clearActiveRun(userId).catch(() => undefined);
    }
    await stopLocationUpdates();
    setFound(null);
  }, [userId]);

  const value = useMemo<GpsContextValue>(
    () => ({
      recorder,
      recovered,
      lastResult,
      start,
      pause: pauseRun,
      resume: resumeRun,
      stop,
      discard,
      continueRecovered,
      discardRecovered,
      dismissResult: () => setLastResult(null),
    }),
    [continueRecovered, discard, discardRecovered, lastResult, recorder, recovered, start, stop],
  );

  return <GpsContext.Provider value={value}>{children}</GpsContext.Provider>;
}

export function useGps(): GpsContextValue {
  const context = useContext(GpsContext);
  if (!context) {
    throw new Error('useGps must be used inside <GpsProvider>.');
  }
  return context;
}
