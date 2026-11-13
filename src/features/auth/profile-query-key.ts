/** Shared cache key for the current user's profile. */
export const profileQueryKey = (userId: string) => ['profile', userId] as const;
