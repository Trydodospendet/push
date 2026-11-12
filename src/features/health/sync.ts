import { supabase } from '@/lib/supabase';

import type { HealthSnapshot } from './types';

/** DB: sync_workouts accepts at most 500 entries per call. */
export const WORKOUT_BATCH_SIZE = 500;

/**
 * Sends what was read from the phone to the server. The server validates every entry and
 * recomputes the progress of the caller's running challenges; the app never decides what
 * counts.
 */
export async function uploadSnapshot(snapshot: HealthSnapshot): Promise<void> {
  for (let index = 0; index < snapshot.workouts.length; index += WORKOUT_BATCH_SIZE) {
    const { error } = await supabase.rpc('sync_workouts', {
      p_workouts: snapshot.workouts.slice(index, index + WORKOUT_BATCH_SIZE),
    });
    if (error) {
      throw error;
    }
  }
  if (snapshot.days.length > 0) {
    const { error } = await supabase.rpc('sync_daily_steps', { p_days: snapshot.days });
    if (error) {
      throw error;
    }
  }
}
