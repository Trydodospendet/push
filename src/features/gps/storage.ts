import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

import { decodeTrack, encodeTrack } from './codec';
import type { TrackPoint } from './geo';

/**
 * What the phone keeps about GPS runs until the server has them:
 *   * the run in progress (a checkpoint, so a crash or a killed app does not lose it)
 *   * finished runs that could not be uploaded yet (no connection)
 * Tracks are stored in the compact text form of ./codec.
 */
const storedRunSchema = z.object({
  runId: z.string().min(1),
  track: z.string(),
});

const queueSchema = z.array(z.string().min(1));

const activeKey = (userId: string) => `push.gps.active.${userId}`;
const queueKey = (userId: string) => `push.gps.pending.${userId}`;
const runKey = (userId: string, runId: string) => `push.gps.run.${userId}.${runId}`;

export type StoredRun = { runId: string; points: TrackPoint[] };

async function readRun(key: string): Promise<StoredRun | null> {
  try {
    const raw = await secureStorage.getItem(key);
    const parsed = storedRunSchema.safeParse(raw === null ? null : JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    const points = decodeTrack(parsed.data.track);
    return points.length > 0 ? { runId: parsed.data.runId, points } : null;
  } catch {
    return null;
  }
}

async function writeRun(key: string, runId: string, points: readonly TrackPoint[]): Promise<void> {
  await secureStorage.setItem(key, JSON.stringify({ runId, track: encodeTrack(points) }));
}

export function saveActiveRun(
  userId: string,
  runId: string,
  points: readonly TrackPoint[],
): Promise<void> {
  return writeRun(activeKey(userId), runId, points);
}

export function loadActiveRun(userId: string): Promise<StoredRun | null> {
  return readRun(activeKey(userId));
}

export function clearActiveRun(userId: string): Promise<void> {
  return secureStorage.removeItem(activeKey(userId));
}

async function readQueue(userId: string): Promise<string[]> {
  try {
    const raw = await secureStorage.getItem(queueKey(userId));
    const parsed = queueSchema.safeParse(raw === null ? [] : JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Queues a finished run for upload. */
export async function enqueueRun(
  userId: string,
  runId: string,
  points: readonly TrackPoint[],
): Promise<void> {
  await writeRun(runKey(userId, runId), runId, points);
  const queue = await readQueue(userId);
  if (!queue.includes(runId)) {
    await secureStorage.setItem(queueKey(userId), JSON.stringify([...queue, runId]));
  }
}

export async function listQueuedRuns(userId: string): Promise<StoredRun[]> {
  const queue = await readQueue(userId);
  const runs: StoredRun[] = [];
  for (const runId of queue) {
    const run = await readRun(runKey(userId, runId));
    if (run) {
      runs.push(run);
    } else {
      // Damaged or missing: nothing to upload, take it out of the queue.
      await dequeueRun(userId, runId);
    }
  }
  return runs;
}

export async function dequeueRun(userId: string, runId: string): Promise<void> {
  const queue = await readQueue(userId);
  await secureStorage.removeItem(runKey(userId, runId));
  await secureStorage.setItem(
    queueKey(userId),
    JSON.stringify(queue.filter((entry) => entry !== runId)),
  );
}

/** Forgets everything GPS-related of an account on this phone (after account deletion). */
export async function clearGpsStorage(userId: string): Promise<void> {
  const queue = await readQueue(userId);
  for (const runId of queue) {
    await secureStorage.removeItem(runKey(userId, runId));
  }
  await secureStorage.removeItem(queueKey(userId));
  await secureStorage.removeItem(activeKey(userId));
}
