import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const walletQueryKey = (userId: string) => ['wallet', userId] as const;

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
