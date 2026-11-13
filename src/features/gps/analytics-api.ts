import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { gpsKeys, type GpsRun } from './api';

export type Split = {
  km: number;
  distanceM: number;
  seconds: number;
  paceSPerKm: number;
  ascentM: number | null;
};

export type ProfilePoint = { distanceM: number; altitudeM: number | null; paceSPerKm: number };

export type RecordKind =
  'longest_run' | 'fastest_pace_1k' | 'fastest_pace_5k' | 'fastest_pace_10k' | 'best_week';

export type PersonalRecord = { kind: RecordKind; value: number; achievedAt: string };

export type PeriodStat = {
  periodStart: string;
  distanceM: number;
  runs: number;
  durationS: number;
};

const RECORD_KINDS: readonly string[] = [
  'longest_run',
  'fastest_pace_1k',
  'fastest_pace_5k',
  'fastest_pace_10k',
  'best_week',
];

/** Time and pace of every kilometre of an own run (computed by the server, no coordinates). */
export function useRunSplits(runId: string) {
  return useQuery({
    queryKey: [...gpsKeys.all, 'splits', runId] as const,
    queryFn: async (): Promise<Split[]> => {
      const { data, error } = await supabase.rpc('get_gps_run_splits', { p_run_id: runId });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        km: row.km,
        distanceM: row.distance_m,
        seconds: row.seconds,
        paceSPerKm: row.pace_s_per_km,
        ascentM: row.ascent_m,
      }));
    },
  });
}

/** Pace and altitude over the distance of an own run. */
export function useRunProfile(runId: string) {
  return useQuery({
    queryKey: [...gpsKeys.all, 'profile', runId] as const,
    queryFn: async (): Promise<ProfilePoint[]> => {
      const { data, error } = await supabase.rpc('get_gps_run_profile', { p_run_id: runId });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        distanceM: row.distance_m,
        altitudeM: row.altitude_m,
        paceSPerKm: row.pace_s_per_km,
      }));
    },
  });
}

export function useMyRecords(userId: string) {
  return useQuery({
    queryKey: [...gpsKeys.all, 'records', userId] as const,
    queryFn: async (): Promise<PersonalRecord[]> => {
      const { data, error } = await supabase.rpc('get_my_records');
      if (error) {
        throw error;
      }
      return data.flatMap((row) =>
        RECORD_KINDS.includes(row.kind)
          ? [{ kind: row.kind as RecordKind, value: row.value, achievedAt: row.achieved_at }]
          : [],
      );
    },
  });
}

/** The last weeks or months with distance, number of runs and time. */
export function usePeriodStats(userId: string, unit: 'week' | 'month') {
  return useQuery({
    queryKey: [...gpsKeys.all, 'period', userId, unit] as const,
    queryFn: async (): Promise<PeriodStat[]> => {
      const { data, error } = await supabase.rpc('get_my_period_stats', {
        p_unit: unit,
        p_count: unit === 'week' ? 8 : 6,
      });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        periodStart: row.period_start,
        distanceM: row.distance_m,
        runs: row.runs,
        durationS: row.duration_s,
      }));
    },
  });
}

/** Shapes (no coordinates) of the latest runs for the mini maps of the history. */
export function useRunShapes(userId: string) {
  return useQuery({
    queryKey: [...gpsKeys.all, 'shapes', userId] as const,
    queryFn: async (): Promise<Map<string, [number, number][]>> => {
      const { data, error } = await supabase.rpc('get_my_run_shapes', { p_limit: 30 });
      if (error) {
        throw error;
      }
      const shapes = new Map<string, [number, number][]>();
      for (const row of data) {
        if (Array.isArray(row.shape)) {
          shapes.set(
            row.run_id,
            row.shape.flatMap((point) =>
              Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number'
                ? [[point[0], point[1]] as [number, number]]
                : [],
            ),
          );
        }
      }
      return shapes;
    },
  });
}

/** Which records a run holds right now (the record was set at the start time of this run). */
export function recordsHeldBy(
  run: Pick<GpsRun, 'startedAt'>,
  records: readonly PersonalRecord[],
): RecordKind[] {
  return records
    .filter((record) => record.kind !== 'best_week')
    .filter((record) => Math.abs(Date.parse(record.achievedAt) - Date.parse(run.startedAt)) < 2000)
    .map((record) => record.kind);
}
