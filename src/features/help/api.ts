import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const helpKeys = {
  all: ['help'] as const,
  appeals: (userId: string) => [...helpKeys.all, 'appeals', userId] as const,
  gpsAppeals: (userId: string) => [...helpKeys.all, 'gps-appeals', userId] as const,
};

export type AppealStatus = 'open' | 'accepted' | 'rejected';

export type Appeal = {
  id: string;
  workoutId: string;
  message: string;
  status: AppealStatus;
  resolutionNote: string | null;
  createdAt: string;
  distanceM: number | null;
  startAt: string | null;
};

function isStatus(value: string): value is AppealStatus {
  return value === 'open' || value === 'accepted' || value === 'rejected';
}

/** The own appeals, newest first. */
export function useMyAppeals(userId: string) {
  return useQuery({
    queryKey: helpKeys.appeals(userId),
    queryFn: async (): Promise<Appeal[]> => {
      const { data, error } = await supabase
        .from('appeals')
        .select(
          'id, workout_id, message, status, resolution_note, created_at, workout:activity_workouts(distance_m, start_at)',
        )
        .order('created_at', { ascending: false });
      if (error) {
        throw error;
      }
      return data.flatMap((row) =>
        isStatus(row.status)
          ? [
              {
                id: row.id,
                workoutId: row.workout_id,
                message: row.message,
                status: row.status,
                resolutionNote: row.resolution_note,
                createdAt: row.created_at,
                distanceM: row.workout?.distance_m ?? null,
                startAt: row.workout?.start_at ?? null,
              },
            ]
          : [],
      );
    },
  });
}

/** Appeal status per GPS run id (for the run list and the run detail). */
export function useGpsRunAppeals(userId: string) {
  return useQuery({
    queryKey: helpKeys.gpsAppeals(userId),
    queryFn: async (): Promise<Map<string, AppealStatus>> => {
      const { data, error } = await supabase.rpc('get_my_gps_run_appeals');
      if (error) {
        throw error;
      }
      return new Map(
        data.flatMap((row) => (isStatus(row.status) ? [[row.run_id, row.status] as const] : [])),
      );
    },
  });
}

export type AppealTarget = { workoutId: string } | { gpsRunId: string };

export function useSubmitAppeal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, message }: { target: AppealTarget; message: string }) => {
      const { error } =
        'gpsRunId' in target
          ? await supabase.rpc('submit_gps_run_appeal', {
              p_run_id: target.gpsRunId,
              p_message: message,
            })
          : await supabase.rpc('submit_appeal', {
              p_workout_id: target.workoutId,
              p_message: message,
            });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: helpKeys.all }),
    meta: { userId },
  });
}
