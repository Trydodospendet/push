import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { profileQueryKey } from '@/features/auth/api';
import { supabase } from '@/lib/supabase';

export const accountKeys = {
  avatar: (path: string) => ['avatar-url', path] as const,
};

/** Smallest password the app accepts (the server enforces its own minimum as well). */
export const PASSWORD_MIN_LENGTH = 8;

const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 256;
const SIGNED_URL_SECONDS = 3600;

/** Sign in with e-mail and password (an alternative to the code). */
export function useSignInWithPassword() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
    },
  });
}

/** Sets or changes the password of the signed-in account. */
export function useSetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
    },
  });
}

/** Starts an e-mail change: a 6-digit code goes to the new address. */
export function useRequestEmailChange() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        throw error;
      }
    },
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email_change',
      });
      if (error) {
        throw error;
      }
    },
  });
}

/** Signs out on every device, this one included. */
export function useSignOutEverywhere() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        throw error;
      }
    },
  });
}

export function useSetRankingVisibility(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (anonymous: boolean) => {
      const { error } = await supabase.rpc('set_ranking_visibility', { p_anonymous: anonymous });
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

/** A temporary link to the own avatar (the bucket is private). Null without an avatar. */
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: accountKeys.avatar(path ?? ''),
    enabled: Boolean(path),
    // Renew a bit before the link expires.
    staleTime: (SIGNED_URL_SECONDS - 300) * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path ?? '', SIGNED_URL_SECONDS);
      if (error) {
        throw error;
      }
      return data.signedUrl;
    },
  });
}

export type AvatarOutcome = 'saved' | 'cancelled' | 'denied';

/**
 * Picks a photo, cuts it square, shrinks it to 256 × 256 pixels (JPEG, well under the 512 KB
 * limit of the bucket), uploads it into the own folder and remembers the path.
 */
export function useChangeAvatar(userId: string, currentPath: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AvatarOutcome> => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return 'denied';
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) {
        return 'cancelled';
      }
      const small = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const body = await (await fetch(small.uri)).arrayBuffer();
      const path = `${userId}/avatar-${Date.now()}.jpg`;

      const upload = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, body, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) {
        throw upload.error;
      }
      const saved = await supabase.rpc('set_avatar_path', { p_path: path });
      if (saved.error) {
        throw saved.error;
      }
      if (currentPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([currentPath]);
      }
      return 'saved';
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

export function useRemoveAvatar(userId: string, currentPath: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const saved = await supabase.rpc('set_avatar_path', {});
      if (saved.error) {
        throw saved.error;
      }
      if (currentPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([currentPath]);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) }),
  });
}

/** All data of the account as JSON text (GPS tracks only on request). */
export function useExportData() {
  return useMutation({
    mutationFn: async (includeRoutes: boolean): Promise<string> => {
      const { data, error } = await supabase.rpc('export_my_data', {
        p_include_routes: includeRoutes,
      });
      if (error) {
        throw error;
      }
      return JSON.stringify(data, null, 2);
    },
  });
}

/** Removes the avatar file(s) of an account (called before the account is deleted). */
export async function removeAllAvatars(userId: string): Promise<void> {
  const list = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const names = (list.data ?? []).map((file) => `${userId}/${file.name}`);
  if (names.length > 0) {
    await supabase.storage.from(AVATAR_BUCKET).remove(names);
  }
}
