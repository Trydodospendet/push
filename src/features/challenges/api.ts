import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { de } from '@/i18n/de';
import { supabase } from '@/lib/supabase';

import type { CreateGoalInput } from './schemas';
import type { Challenge, LeaderboardEntry, MyChallenge, Participant } from './types';

export const challengeKeys = {
  all: ['challenges'] as const,
  open: (mode: string) => [...challengeKeys.all, 'open', mode] as const,
  mine: (userId: string) => [...challengeKeys.all, 'mine', userId] as const,
  detail: (id: string) => [...challengeKeys.all, 'detail', id] as const,
  participants: (id: string) => [...challengeKeys.all, 'participants', id] as const,
  leaderboard: (id: string) => [...challengeKeys.all, 'leaderboard', id] as const,
  byCode: (code: string) => [...challengeKeys.all, 'code', code] as const,
};

/** After joining or leaving: challenges, wallet and ledger changed on the server. */
function invalidateAfterBooking(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: challengeKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['wallet'] }),
    queryClient.invalidateQueries({ queryKey: ['ledger'] }),
  ]);
}

/** Public challenges of one mode that are open and have not started yet. */
export function useOpenChallenges(mode: 'ranked' | 'pool') {
  return useQuery({
    queryKey: challengeKeys.open(mode),
    queryFn: async (): Promise<Challenge[]> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('mode', mode)
        .eq('visibility', 'public')
        .eq('status', 'open')
        .gt('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(50);
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

/** Challenges the user joined or created, soonest first. */
export function useMyChallenges(userId: string) {
  return useQuery({
    queryKey: challengeKeys.mine(userId),
    queryFn: async (): Promise<MyChallenge[]> => {
      const [joined, created] = await Promise.all([
        supabase
          .from('challenge_participants')
          .select('challenge:challenges(*)')
          .eq('user_id', userId),
        supabase.from('challenges').select('*').eq('creator_id', userId),
      ]);
      if (joined.error) {
        throw joined.error;
      }
      if (created.error) {
        throw created.error;
      }

      const byId = new Map<string, MyChallenge>();
      for (const row of joined.data) {
        if (row.challenge) {
          byId.set(row.challenge.id, {
            ...row.challenge,
            isParticipant: true,
            isCreator: row.challenge.creator_id === userId,
          });
        }
      }
      for (const challenge of created.data) {
        if (!byId.has(challenge.id)) {
          byId.set(challenge.id, { ...challenge, isParticipant: false, isCreator: true });
        }
      }
      return [...byId.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
  });
}

export function useChallenge(id: string) {
  return useQuery({
    queryKey: challengeKeys.detail(id),
    queryFn: async (): Promise<Challenge | null> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

/** Only participants can read the list (RLS); for everybody else it is empty. */
export function useParticipants(challengeId: string) {
  return useQuery({
    queryKey: challengeKeys.participants(challengeId),
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from('challenge_participants')
        .select(
          'id, user_id, result, stake_cents, payout_cents, joined_at, profile:profiles(display_name)',
        )
        .eq('challenge_id', challengeId)
        .order('joined_at');
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        displayName: row.profile?.display_name ?? de.challenge.deletedAccount,
        result: row.result,
        stakeCents: row.stake_cents,
        payoutCents: row.payout_cents,
      }));
    },
  });
}

/** Ranking of a ranked challenge, computed by the server (empty for non-participants). */
export function useLeaderboard(challengeId: string, enabled: boolean) {
  return useQuery({
    queryKey: challengeKeys.leaderboard(challengeId),
    enabled,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        p_challenge_id: challengeId,
      });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        rank: row.rank,
        userId: row.user_id,
        displayName: row.display_name,
        isMe: row.is_me,
        goalReached: row.goal_reached,
      }));
    },
  });
}

/** Read-only preview of a challenge by invite code (works for private challenges). */
export function useChallengeByCode(code: string | null) {
  return useQuery({
    queryKey: challengeKeys.byCode(code ?? ''),
    enabled: code !== null,
    retry: false,
    queryFn: async (): Promise<Challenge> => {
      const { data, error } = await supabase.rpc('get_challenge_by_code', { p_code: code ?? '' });
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

/** Creates a personal goal; the stake is bound at once (refundable until the start). */
export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<Challenge> => {
      const { data, error } = await supabase.rpc('create_goal', {
        p_title: input.title,
        p_goal_type: input.goalType,
        p_target_value: input.targetValue,
        p_stake_cents: input.stakeCents,
        p_period: input.period,
      });
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: () => invalidateAfterBooking(queryClient),
  });
}

export type PoolOverview = { people: number; goals: number; boundCents: number };

/** App-wide numbers for the pool screen: people and bound credits (aggregates only). */
export function usePoolOverview() {
  return useQuery({
    queryKey: [...challengeKeys.all, 'pool-overview'] as const,
    queryFn: async (): Promise<PoolOverview> => {
      const { data, error } = await supabase.rpc('get_pool_overview');
      if (error) {
        throw error;
      }
      const row = data[0];
      return {
        people: row?.people ?? 0,
        goals: row?.goals ?? 0,
        boundCents: Number(row?.bound_cents ?? 0),
      };
    },
  });
}

export type GoalWindow = { goals: number; stakesCents: number };

/** How many goals and how many credits are in the period of one of my goals. */
export function useGoalWindow(challengeId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...challengeKeys.all, 'goal-window', challengeId] as const,
    enabled,
    queryFn: async (): Promise<GoalWindow> => {
      const { data, error } = await supabase.rpc('get_goal_window', {
        p_challenge_id: challengeId,
      });
      if (error) {
        throw error;
      }
      const row = data[0];
      return { goals: row?.goals ?? 0, stakesCents: Number(row?.stakes_cents ?? 0) };
    },
  });
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    /** `stakeCents` is the own stake in a pool; without it the stake of the challenge applies. */
    mutationFn: async (
      target: ({ challengeId: string } | { code: string }) & { stakeCents?: number },
    ) => {
      const { error } =
        'code' in target
          ? await supabase.rpc('join_challenge_by_code', {
              p_code: target.code,
              p_stake_cents: target.stakeCents,
            })
          : await supabase.rpc('join_challenge', {
              p_challenge_id: target.challengeId,
              p_stake_cents: target.stakeCents,
            });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => invalidateAfterBooking(queryClient),
  });
}

export function useLeaveChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc('leave_challenge', { p_challenge_id: challengeId });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => invalidateAfterBooking(queryClient),
  });
}
