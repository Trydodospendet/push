import { supabase } from '@/lib/supabase';

import { dequeueRun, listQueuedRuns } from './storage';
import { buildUploadPayload } from './recorder';

export type UploadedRun = {
  runId: string;
  distanceM: number;
  durationS: number;
  isValid: boolean;
  invalidReason: string | null;
};

/** The server will never accept these; retrying would only repeat the error. */
const PERMANENT_ERRORS = ['invalid_gps_payload', 'gps_batch_too_large'];

function errorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : '';
}

/**
 * Uploads the queued runs one by one. A run leaves the queue when the server has it (valid or
 * not – the server's verdict is shown to the user) or when the server rejects its format for
 * good. Connection problems leave it queued for the next attempt. Never throws.
 */
export async function uploadQueuedRuns(userId: string): Promise<UploadedRun[]> {
  const uploaded: UploadedRun[] = [];
  let queued;
  try {
    queued = await listQueuedRuns(userId);
  } catch {
    return uploaded;
  }

  for (const run of queued) {
    const { data, error } = await supabase.rpc('sync_gps_run', {
      p_run: buildUploadPayload(run.runId, run.points),
    });
    if (error) {
      if (PERMANENT_ERRORS.some((code) => errorMessage(error).includes(code))) {
        await dequeueRun(userId, run.runId).catch(() => undefined);
        continue;
      }
      // No connection, rate limit, …: keep it and try again later.
      break;
    }
    const row = Array.isArray(data) ? data[0] : undefined;
    await dequeueRun(userId, run.runId).catch(() => undefined);
    if (row) {
      uploaded.push({
        runId: run.runId,
        distanceM: row.distance_m,
        durationS: row.duration_s,
        isValid: row.is_valid,
        invalidReason: row.invalid_reason,
      });
    }
  }
  return uploaded;
}
