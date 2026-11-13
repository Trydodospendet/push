import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const activityKeys = {
  all: ['activity'] as const,
  progress: (userId: string) => [...activityKeys.all, 'progress', userId] as const,
  workouts: (userId: string, from: string, to: string) =>
    [...activityKeys.all, 'workouts', userId, from, to] as const,
  steps: (userId: string, firstDay: string, lastDay: string) =>
    [...activityKeys.all, 'steps', userId, firstDay, lastDay] as const,
};

export type Workout = {
  id: string;
  startAt: string;
  distanceM: number;
  durationS: number;
  isValid: boolean;
  invalidReason: string | null;
};

export type DaySteps = {
  date: string;
  steps: number;
  isValid: boolean;
};

/** The caller's progress per challenge, computed by the server. Others' progress is not readable. */
export function useMyProgress(userId: string) {
  return useQuery({
    queryKey: activityKeys.progress(userId),
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('get_my_progress');
      if (error) {
        throw error;
      }
      return Object.fromEntries(data.map((row) => [row.challenge_id, row.progress_value]));
    },
  });
}

/** The caller's runs that started in the given period, newest first (valid and invalid). */
export function useMyWorkouts(userId: string, startsAt: string, endsAt: string, enabled: boolean) {
  return useQuery({
    queryKey: activityKeys.workouts(userId, startsAt, endsAt),
    enabled,
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await supabase
        .from('activity_workouts')
        .select('id, start_at, distance_m, duration_s, is_valid, invalid_reason')
        .eq('user_id', userId)
        .gte('start_at', startsAt)
        .lt('start_at', endsAt)
        .order('start_at', { ascending: false })
        .limit(100);
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        startAt: row.start_at,
        distanceM: row.distance_m,
        durationS: row.duration_s,
        isValid: row.is_valid,
        invalidReason: row.invalid_reason,
      }));
    },
  });
}

/** The caller's daily steps between two local dates (inclusive). */
export function useMyDailySteps(
  userId: string,
  firstDay: string,
  lastDay: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: activityKeys.steps(userId, firstDay, lastDay),
    enabled,
    queryFn: async (): Promise<DaySteps[]> => {
      const { data, error } = await supabase
        .from('activity_daily_steps')
        .select('date, steps, is_valid')
        .eq('user_id', userId)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date');
      if (error) {
        throw error;
      }
      return data.map((row) => ({ date: row.date, steps: row.steps, isValid: row.is_valid }));
    },
  });
}

export type RecentWorkout = Workout & { sourceRecordId: string; platform: string };

/** All runs of the last 45 days that the server received from the phone, newest first. */
export function useRecentWorkouts(userId: string) {
  return useQuery({
    queryKey: [...activityKeys.all, 'recent-workouts', userId] as const,
    queryFn: async (): Promise<RecentWorkout[]> => {
      const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('activity_workouts')
        .select(
          'id, start_at, distance_m, duration_s, is_valid, invalid_reason, source_record_id, platform',
        )
        .eq('user_id', userId)
        .gte('start_at', since)
        .order('start_at', { ascending: false })
        .limit(50);
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        startAt: row.start_at,
        distanceM: row.distance_m,
        durationS: row.duration_s,
        isValid: row.is_valid,
        invalidReason: row.invalid_reason,
        sourceRecordId: row.source_record_id,
        platform: row.platform,
      }));
    },
  });
}
