import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type FeedKind = 'joined' | 'ran' | 'goal_reached';

export type FeedEntry = {
  id: string;
  kind: FeedKind;
  displayName: string;
  isMine: boolean;
  /** Metres, only for kind = 'ran'. */
  distanceM: number | null;
  createdAt: string;
  cheerCount: number;
  cheeredByMe: boolean;
};

export const feedKeys = {
  all: ['feed'] as const,
  challenge: (challengeId: string) => [...feedKeys.all, challengeId] as const,
};

const KINDS: readonly string[] = ['joined', 'ran', 'goal_reached'];

/** The feed of a challenge; only participants get rows (the server enforces it). */
export function useChallengeFeed(challengeId: string) {
  return useQuery({
    queryKey: feedKeys.challenge(challengeId),
    queryFn: async (): Promise<FeedEntry[]> => {
      const { data, error } = await supabase.rpc('get_challenge_feed', {
        p_challenge_id: challengeId,
      });
      if (error) {
        throw error;
      }
      return data
        .filter((row) => KINDS.includes(row.kind))
        .map((row) => ({
          id: row.id,
          kind: row.kind as FeedKind,
          displayName: row.display_name,
          isMine: row.is_mine,
          distanceM: row.distance_m,
          createdAt: row.created_at,
          cheerCount: row.cheer_count,
          cheeredByMe: row.cheered_by_me,
        }));
    },
  });
}

export function useCheer(challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (feedId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('cheer_feed_entry', { p_feed_id: feedId });
      if (error) {
        throw error;
      }
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: feedKeys.challenge(challengeId) }),
  });
}
