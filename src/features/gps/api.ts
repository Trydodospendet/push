import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const gpsKeys = {
  all: ['gps'] as const,
  runs: (userId: string) => [...gpsKeys.all, 'runs', userId] as const,
  route: (runId: string) => [...gpsKeys.all, 'route', runId] as const,
};

export type GpsRun = {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceM: number;
  durationS: number;
  isValid: boolean;
  invalidReason: string | null;
  hasRoute: boolean;
};

export type RoutePoint = { lat: number; lng: number; segment: number };

/** The signed-in user's own GPS runs, newest first. The server returns nobody else's. */
export function useMyGpsRuns(userId: string) {
  return useQuery({
    queryKey: gpsKeys.runs(userId),
    queryFn: async (): Promise<GpsRun[]> => {
      const { data, error } = await supabase.rpc('get_my_gps_runs', { p_limit: 30 });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        distanceM: row.distance_m,
        durationS: row.duration_s,
        isValid: row.is_valid,
        invalidReason: row.invalid_reason,
        hasRoute: row.has_route,
      }));
    },
  });
}

/** The route of an own run, already without its first and last 200 m (cut by the server). */
export function useGpsRunRoute(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: gpsKeys.route(runId),
    enabled,
    queryFn: async (): Promise<RoutePoint[]> => {
      const { data, error } = await supabase.rpc('get_gps_run_route', { p_run_id: runId });
      if (error) {
        throw error;
      }
      return data.map((row) => ({ lat: row.lat, lng: row.lng, segment: row.segment }));
    },
  });
}
