import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey } from '@/features/auth/profile-query-key';
import { supabase } from '@/lib/supabase';

export const donationKeys = {
  all: ['donations'] as const,
  ngos: () => [...donationKeys.all, 'ngos'] as const,
  challenge: (challengeId: string) => [...donationKeys.all, 'challenge', challengeId] as const,
  result: (challengeId: string) => [...donationKeys.all, 'result', challengeId] as const,
  list: () => [...donationKeys.all, 'list'] as const,
  totals: () => [...donationKeys.all, 'totals'] as const,
};

export type Ngo = { id: string; name: string };

export type ChallengeDonation = {
  donate: boolean | null;
  ngoId: string | null;
  effectiveDonate: boolean;
  effectiveNgoId: string | null;
};

export type ChallengeResult = {
  rank: number | null;
  rankPoints: number;
  payoutCents: number | null;
  donatedCents: number;
};

export type DonationEntry = {
  challengeId: string | null;
  title: string | null;
  ngoName: string;
  amountCents: number;
  createdAt: string;
};

export type DonationTotal = { ngoId: string; ngoName: string; totalCents: number; count: number };

/** The NGO placeholders (read-only list). */
export function useNgos() {
  return useQuery({
    queryKey: donationKeys.ngos(),
    queryFn: async (): Promise<Ngo[]> => {
      const { data, error } = await supabase.from('ngos').select('id, name').order('sort_order');
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

/** Default donation setting of the profile. */
export function useSetDonationDefaults(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { donate: boolean; ngoId: string | null }) => {
      const { error } = await supabase.rpc('set_donation_defaults', {
        p_donate: input.donate,
        p_ngo_id: input.ngoId ?? undefined,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

/** The own donation choice for one challenge (null = use the default of the profile). */
export function useMyChallengeDonation(challengeId: string, enabled: boolean) {
  return useQuery({
    queryKey: donationKeys.challenge(challengeId),
    enabled,
    queryFn: async (): Promise<ChallengeDonation | null> => {
      const { data, error } = await supabase.rpc('get_my_challenge_donation', {
        p_challenge_id: challengeId,
      });
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : undefined;
      return row
        ? {
            donate: row.donate,
            ngoId: row.ngo_id,
            effectiveDonate: row.effective_donate,
            effectiveNgoId: row.effective_ngo_id,
          }
        : null;
    },
  });
}

export function useSetChallengeDonation(challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { donate: boolean | null; ngoId: string | null }) => {
      const { error } = await supabase.rpc('set_challenge_donation', {
        p_challenge_id: challengeId,
        p_donate: input.donate ?? undefined,
        p_ngo_id: input.ngoId ?? undefined,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: donationKeys.challenge(challengeId) }),
  });
}

/** Own rank, points, payout and donated amount (computed by the server). */
export function useMyChallengeResult(challengeId: string, enabled: boolean) {
  return useQuery({
    queryKey: donationKeys.result(challengeId),
    enabled,
    queryFn: async (): Promise<ChallengeResult | null> => {
      const { data, error } = await supabase.rpc('get_my_challenge_result', {
        p_challenge_id: challengeId,
      });
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : undefined;
      return row
        ? {
            rank: row.rank,
            rankPoints: row.rank_points,
            payoutCents: row.payout_cents,
            donatedCents: row.donated_cents,
          }
        : null;
    },
  });
}

export function useMyDonations() {
  return useQuery({
    queryKey: donationKeys.list(),
    queryFn: async (): Promise<DonationEntry[]> => {
      const { data, error } = await supabase.rpc('get_my_donations');
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        challengeId: row.challenge_id,
        title: row.title,
        ngoName: row.ngo_name,
        amountCents: row.amount_cents,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useMyDonationTotals() {
  return useQuery({
    queryKey: donationKeys.totals(),
    queryFn: async (): Promise<DonationTotal[]> => {
      const { data, error } = await supabase.rpc('get_my_donation_totals');
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        ngoId: row.ngo_id,
        ngoName: row.ngo_name,
        totalCents: row.total_cents,
        count: row.donations,
      }));
    },
  });
}
