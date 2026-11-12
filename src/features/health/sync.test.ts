import { supabase } from '@/lib/supabase';

import { uploadSnapshot, WORKOUT_BATCH_SIZE } from './sync';
import type { DayInput, WorkoutInput } from './types';

jest.mock('@/lib/supabase');

const rpc = jest.mocked(supabase.rpc);

function workout(index: number): WorkoutInput {
  return {
    platform: 'android',
    source_record_id: `run-${index}`,
    source_name: 'app',
    activity_type: 'running',
    start_at: '2026-11-13T10:00:00Z',
    end_at: '2026-11-13T10:30:00Z',
    distance_m: 5000,
    duration_s: 1800,
    was_user_entered: false,
  };
}

const day: DayInput = { date: '2026-11-13', platform: 'android', steps: 9000, excluded_sources: 0 };

describe('uploadSnapshot', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: 1, error: null } as never);
  });

  it('sends workouts in batches of at most 500 and then the days', async () => {
    const workouts = Array.from({ length: WORKOUT_BATCH_SIZE + 1 }, (_, index) => workout(index));
    await uploadSnapshot({ workouts, days: [day] });

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[0][0]).toBe('sync_workouts');
    expect((rpc.mock.calls[0][1] as { p_workouts: unknown[] }).p_workouts).toHaveLength(500);
    expect((rpc.mock.calls[1][1] as { p_workouts: unknown[] }).p_workouts).toHaveLength(1);
    expect(rpc.mock.calls[2]).toEqual(['sync_daily_steps', { p_days: [day] }]);
  });

  it('skips calls without data', async () => {
    await uploadSnapshot({ workouts: [], days: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('stops and throws the server error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'health_batch_too_large' },
    } as never);
    await expect(uploadSnapshot({ workouts: [workout(1)], days: [day] })).rejects.toEqual({
      message: 'health_batch_too_large',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
