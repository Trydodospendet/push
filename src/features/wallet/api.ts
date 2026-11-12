import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const walletQueryKey = (userId: string) => ['wallet', userId] as const;
export const ledgerQueryKey = (userId: string) => ['ledger', userId] as const;

export type LedgerEntry = {
  id: string;
  type: string;
  amountCents: number;
  createdAt: string;
  /** Null for entries without challenge or if the challenge is no longer visible. */
  challengeTitle: string | null;
};

/** The caller's balance in cents. Computed and stored by the server only. */
export function useWalletBalance(userId: string) {
  return useQuery({
    queryKey: walletQueryKey(userId),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance_cents')
        .eq('user_id', userId)
        .single();
      if (error) {
        throw error;
      }
      return data.balance_cents;
    },
  });
}

/** The caller's bookings, newest first. */
export function useLedger(userId: string) {
  return useQuery({
    queryKey: ledgerQueryKey(userId),
    queryFn: async (): Promise<LedgerEntry[]> => {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('id, type, amount_cents, created_at, challenge:challenges(title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        type: row.type,
        amountCents: row.amount_cents,
        createdAt: row.created_at,
        challengeTitle: row.challenge?.title ?? null,
      }));
    },
  });
}
