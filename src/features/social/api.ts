import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey } from '@/features/auth/api';
import { supabase } from '@/lib/supabase';

export const socialKeys = {
  all: ['social'] as const,
  code: () => [...socialKeys.all, 'code'] as const,
  friends: () => [...socialKeys.all, 'friends'] as const,
  requests: () => [...socialKeys.all, 'requests'] as const,
  runs: () => [...socialKeys.all, 'runs'] as const,
  comments: (workoutId: string) => [...socialKeys.all, 'comments', workoutId] as const,
  groups: () => [...socialKeys.all, 'groups'] as const,
  board: (groupId: string, period: string) =>
    [...socialKeys.all, 'board', groupId, period] as const,
  season: () => [...socialKeys.all, 'season'] as const,
};

export type Friend = { userId: string; displayName: string };
export type FriendRequest = { id: string; displayName: string; createdAt: string };
export type FriendRun = {
  workoutId: string;
  userId: string;
  displayName: string;
  isMine: boolean;
  distanceM: number;
  durationS: number;
  startAt: string;
  kudosCount: number;
  commentCount: number;
  kudosByMe: boolean;
};
export type RunComment = {
  id: string;
  displayName: string;
  isMine: boolean;
  body: string;
  createdAt: string;
};
export type Group = { id: string; name: string; inviteCode: string; memberCount: number };
export type BoardRow = {
  rank: number;
  displayName: string;
  isMe: boolean;
  distanceM: number;
  runs: number;
};
export type SeasonRow = { rank: number; displayName: string; isMe: boolean; points: number };

export function useFriendCode() {
  return useQuery({
    queryKey: socialKeys.code(),
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('get_my_friend_code');
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useFriends() {
  return useQuery({
    queryKey: socialKeys.friends(),
    queryFn: async (): Promise<Friend[]> => {
      const { data, error } = await supabase.rpc('get_my_friends');
      if (error) {
        throw error;
      }
      return data.map((row) => ({ userId: row.user_id, displayName: row.display_name }));
    },
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: socialKeys.requests(),
    queryFn: async (): Promise<FriendRequest[]> => {
      const { data, error } = await supabase.rpc('get_friend_requests');
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        createdAt: row.created_at,
      }));
    },
  });
}

function useSocialMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialKeys.all }),
  });
}

async function call(result: PromiseLike<{ error: unknown; data?: unknown }>): Promise<unknown> {
  const { error, data } = await result;
  if (error) {
    throw error;
  }
  return data;
}

/** Returns 'pending' (waiting for the other person) or 'accepted' (they had asked first). */
export function useSendFriendRequest() {
  return useSocialMutation(async (code: string) =>
    call(supabase.rpc('send_friend_request', { p_code: code })),
  );
}

export function useRespondFriendRequest() {
  return useSocialMutation(async (input: { id: string; accept: boolean }) =>
    call(
      supabase.rpc('respond_friend_request', { p_friendship_id: input.id, p_accept: input.accept }),
    ),
  );
}

export function useRemoveFriend() {
  return useSocialMutation(async (userId: string) =>
    call(supabase.rpc('remove_friend', { p_user_id: userId })),
  );
}

export function useSetShareRuns(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (share: boolean) => call(supabase.rpc('set_share_runs', { p_share: share })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

export function useFriendRuns() {
  return useQuery({
    queryKey: socialKeys.runs(),
    queryFn: async (): Promise<FriendRun[]> => {
      const { data, error } = await supabase.rpc('get_friend_runs', { p_limit: 30 });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        workoutId: row.workout_id,
        userId: row.user_id,
        displayName: row.display_name,
        isMine: row.is_mine,
        distanceM: row.distance_m,
        durationS: row.duration_s,
        startAt: row.start_at,
        kudosCount: row.kudos_count,
        commentCount: row.comment_count,
        kudosByMe: row.kudos_by_me,
      }));
    },
  });
}

export function useGiveKudos() {
  return useSocialMutation(async (workoutId: string) =>
    call(supabase.rpc('give_kudos', { p_workout_id: workoutId })),
  );
}

export function useRunComments(workoutId: string, enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.comments(workoutId),
    enabled,
    queryFn: async (): Promise<RunComment[]> => {
      const { data, error } = await supabase.rpc('get_run_comments', { p_workout_id: workoutId });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        isMine: row.is_mine,
        body: row.body,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useAddComment() {
  return useSocialMutation(async (input: { workoutId: string; body: string }) =>
    call(supabase.rpc('add_run_comment', { p_workout_id: input.workoutId, p_body: input.body })),
  );
}

export function useDeleteComment() {
  return useSocialMutation(async (commentId: string) =>
    call(supabase.rpc('delete_run_comment', { p_comment_id: commentId })),
  );
}

export function useGroups() {
  return useQuery({
    queryKey: socialKeys.groups(),
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase.rpc('get_my_groups');
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        inviteCode: row.invite_code,
        memberCount: row.member_count,
      }));
    },
  });
}

export function useCreateGroup() {
  return useSocialMutation(async (name: string) =>
    call(supabase.rpc('create_group', { p_name: name })),
  );
}

export function useJoinGroup() {
  return useSocialMutation(async (code: string) =>
    call(supabase.rpc('join_group', { p_code: code })),
  );
}

export function useLeaveGroup() {
  return useSocialMutation(async (groupId: string) =>
    call(supabase.rpc('leave_group', { p_group_id: groupId })),
  );
}

export function useGroupBoard(groupId: string, period: 'week' | 'month', enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.board(groupId, period),
    enabled,
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await supabase.rpc('get_group_board', {
        p_group_id: groupId,
        p_period: period,
      });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        rank: row.rank,
        displayName: row.display_name,
        isMe: row.is_me,
        distanceM: row.distance_m,
        runs: row.runs,
      }));
    },
  });
}

export function useSeasonBoard() {
  return useQuery({
    queryKey: socialKeys.season(),
    queryFn: async (): Promise<SeasonRow[]> => {
      const { data, error } = await supabase.rpc('get_season_board', { p_limit: 20 });
      if (error) {
        throw error;
      }
      return data.map((row) => ({
        rank: row.rank,
        displayName: row.display_name,
        isMe: row.is_me,
        points: row.points,
      }));
    },
  });
}

/** The link that opens PUSH on the friend request screen (hosted landing page, see docs/legal/i.html). */
export function inviteLink(code: string): string {
  return `https://puschdich.netlify.app/i.html?c=${encodeURIComponent(code)}`;
}

/** The same as a direct app link, for people who have the app (custom scheme). */
export function inviteDeepLink(code: string): string {
  return `push://invite/${encodeURIComponent(code)}`;
}

/** Link to a challenge by its invite code (opens the "join with code" screen). */
export function challengeJoinLink(code: string): string {
  return `https://puschdich.netlify.app/i.html?j=${encodeURIComponent(code)}`;
}
