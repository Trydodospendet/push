import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const statsKeys = {
  all: ['stats'] as const,
  summary: (userId: string) => [...statsKeys.all, 'summary', userId] as const,
  week: (userId: string) => [...statsKeys.all, 'week', userId] as const,
  wins: (userId: string) => [...statsKeys.all, 'wins', userId] as const,
  potentialWin: (challengeId: string) => [...statsKeys.all, 'potential-win', challengeId] as const,
};

export type MyStats = {
  streakDays: number;
  totalDistanceM: number;
  wins: number;
  /** Bonus on top of the stakes, in cents. */
  totalWonCents: number;
};

export type WeekDay = {
  /** Local date, 'YYYY-MM-DD'. */
  date: string;
  distanceM: number;
};

export type Win = {
  challengeId: string;
  title: string;
  mode: string;
  stakeCents: number;
  payoutCents: number;
  settledAt: string;
};

/** Streak, total distance and wins, all computed by the server. */
export function useMyStats(userId: string) {
  return useQuery({
    queryKey: statsKeys.summary(userId),
    queryFn: async (): Promise<MyStats> => {
      const { data, error } = await supabase.rpc('get_my_stats');
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : undefined;
      if (!row) {
        throw new Error('stats_missing');
      }
      return {
        streakDays: row.streak_days,
        totalDistanceM: row.total_distance_m,
        wins: row.wins,
        totalWonCents: row.total_won_cents,
      };
    },
  });
}

/** Valid metres per day for the last seven days, oldest first. */
export function useMyWeek(userId: string) {
  return useQuery({
    queryKey: statsKeys.week(userId),
    queryFn: async (): Promise<WeekDay[]> => {
      const { data, error } = await supabase.rpc('get_my_week');
      if (error) {
        throw error;
      }
      if (!Array.isArray(data)) {
        throw new Error('week_missing');
      }
      return data.map((row) => ({ date: row.day, distanceM: row.distance_m }));
    },
  });
}

/** Won and settled challenges with their real payouts, newest first. */
export function useMyWins(userId: string) {
  return useQuery({
    queryKey: statsKeys.wins(userId),
    queryFn: async (): Promise<Win[]> => {
      const { data, error } = await supabase
        .from('challenge_participants')
        .select(
          'challenge_id, stake_cents, payout_cents, result, challenge:challenges(title, mode, status, settled_at)',
        )
        .eq('user_id', userId)
        .eq('result', 'success');
      if (error) {
        throw error;
      }
      const wins: Win[] = [];
      for (const row of data) {
        const challenge = row.challenge;
        if (
          challenge?.status === 'settled' &&
          challenge.settled_at !== null &&
          row.payout_cents !== null
        ) {
          wins.push({
            challengeId: row.challenge_id,
            title: challenge.title,
            mode: challenge.mode,
            stakeCents: row.stake_cents,
            payoutCents: row.payout_cents,
            settledAt: challenge.settled_at,
          });
        }
      }
      return wins.sort((a, b) => Date.parse(b.settledAt) - Date.parse(a.settledAt));
    },
  });
}

/** The most the user can get from a challenge (everybody else misses), computed by the server. */
export function usePotentialWin(challengeId: string, enabled: boolean) {
  return useQuery({
    queryKey: statsKeys.potentialWin(challengeId),
    enabled,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase.rpc('get_potential_win', {
        p_challenge_id: challengeId,
      });
      if (error) {
        throw error;
      }
      return typeof data === 'number' ? data : null;
    },
  });
}
