import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

export const communityKeys = {
  all: ['community'] as const,
  stats: () => [...communityKeys.all, 'stats'] as const,
  events: () => [...communityKeys.all, 'events'] as const,
};

const statsSchema = z.array(
  z.object({
    runs_today: z.number(),
    goals_week: z.number(),
    donated_cents: z.number(),
  }),
);

const eventsSchema = z.array(
  z.object({
    kind: z.enum(['run', 'goal']),
    goal_type: z.string().nullable(),
    value: z.number(),
    happened_at: z.string(),
  }),
);

export type CommunityStats = { runsToday: number; goalsWeek: number; donatedCents: number };
export type CommunityEvent = {
  kind: 'run' | 'goal';
  goalType: string | null;
  /** Whole kilometres for a run; the target value (metres or steps) for a goal. */
  value: number;
  at: string;
};

// The generated types do not know the two functions of 20261202090000_community_stats.sql yet.
// Until `supabase gen types` was run, the answers are checked with zod instead.
const untyped = supabase as unknown as {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: Error | null }>;
};

/** Real aggregates over everybody: runs today, goals reached this week, donations this month. */
export function useCommunityStats() {
  return useQuery({
    queryKey: communityKeys.stats(),
    queryFn: async (): Promise<CommunityStats> => {
      const { data, error } = await untyped.rpc('get_community_stats');
      if (error) {
        throw error;
      }
      const row = statsSchema.parse(data)[0];
      return {
        runsToday: row?.runs_today ?? 0,
        goalsWeek: row?.goals_week ?? 0,
        donatedCents: row?.donated_cents ?? 0,
      };
    },
  });
}

/** The latest real events without any person (at most 8). */
export function useCommunityEvents() {
  return useQuery({
    queryKey: communityKeys.events(),
    queryFn: async (): Promise<CommunityEvent[]> => {
      const { data, error } = await untyped.rpc('get_community_events');
      if (error) {
        throw error;
      }
      return eventsSchema.parse(data).map((row) => ({
        kind: row.kind,
        goalType: row.goal_type,
        value: row.value,
        at: row.happened_at,
      }));
    },
  });
}
