import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { APP_NAME } from '@/config/app';
import { de } from '@/i18n/de';
import { colors } from '@/theme';

import type { TrackPoint } from './geo';
import {
  initialRecorderState,
  recorderReducer,
  type RecorderAction,
  type RecorderState,
} from './recorder';
import { clearActiveRun, saveActiveRun } from './storage';

export const LOCATION_TASK = 'push-gps-run';

/** The checkpoint on the phone is refreshed at most this often while recording. */
const CHECKPOINT_INTERVAL_MS = 30_000;

type LocationTaskData = { locations: Location.LocationObject[] };

/**
 * The recorder lives outside React: the location task keeps delivering points while the screen
 * is locked (Android foreground service, iOS background location), and the screens only
 * subscribe to this store.
 */
let state: RecorderState = initialRecorderState;
let userId: string | null = null;
let lastCheckpointAt = 0;
const listeners = new Set<() => void>();

export function getRecorderState(): RecorderState {
  return state;
}

export function subscribeRecorder(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Which account the checkpoint belongs to; null while signed out. */
export function setRecorderUser(next: string | null): void {
  userId = next;
}

function checkpoint(force: boolean): void {
  if (userId === null || state.runId === null || state.points.length === 0) {
    return;
  }
  const now = Date.now();
  if (!force && now - lastCheckpointAt < CHECKPOINT_INTERVAL_MS) {
    return;
  }
  lastCheckpointAt = now;
  void saveActiveRun(userId, state.runId, state.points).catch(() => undefined);
}

export function dispatchRecorder(action: RecorderAction): void {
  state = recorderReducer(state, action);
  listeners.forEach((listener) => listener());
  if (action.type === 'points') {
    checkpoint(false);
  } else if (action.type === 'pause' || action.type === 'stop') {
    checkpoint(true);
  }
}

function toPoint(location: Location.LocationObject): Omit<TrackPoint, 'segment'> {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    t: location.timestamp,
    accuracy: location.coords.accuracy ?? Number.MAX_SAFE_INTEGER,
    mocked: location.mocked === true,
  };
}

// Defined at import time: when Android restarts the app only for the location service, the task
// must already be known.
TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations) {
    return;
  }
  dispatchRecorder({ type: 'points', points: data.locations.map(toPoint) });
});

export type PermissionResult = 'granted' | 'denied' | 'blocked';

/**
 * Only "while using the app" is asked for. The run is started from the open app, and from
 * then on the Android foreground service (with its notification) and the iOS background
 * location mode keep it going with the screen locked – expo-location needs no "always"
 * permission for that, so ACCESS_BACKGROUND_LOCATION is not requested at all.
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.granted) {
    return 'granted';
  }
  return foreground.canAskAgain ? 'denied' : 'blocked';
}

export async function hasLocationPermission(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  return foreground.granted;
}

async function startUpdates(): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 3000,
    distanceInterval: 3,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: APP_NAME,
      notificationBody: de.run.notification,
      notificationColor: colors.accent,
    },
  });
}

export async function stopLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

/** Random v4 UUID; it only has to be unique per run, not secret. */
export function newRunId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random % 4) + 8).toString(16);
  });
}

export async function startRun(): Promise<void> {
  dispatchRecorder({ type: 'start', runId: newRunId() });
  try {
    await startUpdates();
  } catch (error) {
    dispatchRecorder({ type: 'reset' });
    throw error;
  }
}

export async function pauseRun(): Promise<void> {
  dispatchRecorder({ type: 'pause' });
  await stopLocationUpdates();
}

export async function resumeRun(): Promise<void> {
  dispatchRecorder({ type: 'resume' });
  await startUpdates();
}

/** Ends the run and returns it (null if there is nothing worth keeping). */
export async function stopRun(): Promise<{ runId: string; points: readonly TrackPoint[] } | null> {
  dispatchRecorder({ type: 'stop' });
  await stopLocationUpdates().catch(() => undefined);
  const { runId, points } = state;
  return runId !== null && points.length >= 2 ? { runId, points } : null;
}

/** Forgets the finished run (after it was queued for upload, or when the user discards it). */
export async function clearRun(): Promise<void> {
  dispatchRecorder({ type: 'reset' });
  if (userId !== null) {
    await clearActiveRun(userId).catch(() => undefined);
  }
}

/** Puts an interrupted run (found in the checkpoint) back into the recorder, paused. */
export function restoreRun(runId: string, points: readonly TrackPoint[]): void {
  dispatchRecorder({ type: 'restore', runId, points });
}
