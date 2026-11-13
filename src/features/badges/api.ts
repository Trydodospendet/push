import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { BADGE_CODES, type BadgeCode } from './catalog';

export const badgeKeys = {
  all: ['badges'] as const,
  mine: (userId: string) => [...badgeKeys.all, 'mine', userId] as const,
  level: (userId: string) => [...badgeKeys.all, 'level', userId] as const,
};

export type MyBadge = {
  code: BadgeCode;
  awardedAt: string;
  seen: boolean;
};

export type MyLevel = {
  points: number;
  level: number;
  levelStartPoints: number;
  nextLevelPoints: number;
};

function isBadgeCode(value: string): value is BadgeCode {
  return (BADGE_CODES as readonly string[]).includes(value);
}

/** Badges the server awarded to the signed-in user, oldest first. */
export function useMyBadges(userId: string) {
  return useQuery({
    queryKey: badgeKeys.mine(userId),
    queryFn: async (): Promise<MyBadge[]> => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge, awarded_at, seen_at')
        .eq('user_id', userId)
        .order('awarded_at');
      if (error) {
        throw error;
      }
      return data.flatMap((row) =>
        isBadgeCode(row.badge)
          ? [{ code: row.badge, awardedAt: row.awarded_at, seen: row.seen_at !== null }]
          : [],
      );
    },
  });
}

/** Points and level, computed by the server. */
export function useMyLevel(userId: string) {
  return useQuery({
    queryKey: badgeKeys.level(userId),
    queryFn: async (): Promise<MyLevel> => {
      const { data, error } = await supabase.rpc('get_my_level');
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : undefined;
      if (!row) {
        throw new Error('level_missing');
      }
      return {
        points: row.points,
        level: row.level,
        levelStartPoints: row.level_start_points,
        nextLevelPoints: row.next_level_points,
      };
    },
  });
}

/** The logo secret: the only badge the app claims itself (the server accepts nothing else). */
export function useClaimLogoBadge(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('claim_secret_badge', { p_secret: 'logo_tap' });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: badgeKeys.mine(userId) }),
  });
}

export function useMarkBadgeSeen(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (badge: BadgeCode): Promise<void> => {
      const { error } = await supabase.rpc('mark_badge_seen', { p_badge: badge });
      if (error) {
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: badgeKeys.mine(userId) }),
  });
}
