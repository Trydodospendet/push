import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type MyProfile = Database['public']['Functions']['get_my_profile']['Returns'];

export const profileQueryKey = (userId: string) => ['profile', userId] as const;

/** Sends a 6-digit sign-in code. Creates the account on first use. */
export function useRequestSignInCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        throw error;
      }
    },
  });
}

/** Verifies the code; on success the auth provider receives the new session. */
export function useVerifySignInCode() {
  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        throw error;
      }
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    },
  });
}

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId ?? 'signed-out'),
    enabled: userId !== undefined,
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await supabase.rpc('get_my_profile');
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useSetDisplayName(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string): Promise<MyProfile> => {
      const { data, error } = await supabase.rpc('set_display_name', {
        p_display_name: displayName,
      });
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(userId), profile);
    },
  });
}
