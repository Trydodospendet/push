import { secureStorage } from '@/lib/secure-storage';

/** The three intro pages were seen on this phone. Kept locally, one flag per account. */
const storageKey = (userId: string) => `push.intro.${userId}`;

export async function loadIntroSeen(userId: string): Promise<boolean> {
  try {
    return (await secureStorage.getItem(storageKey(userId))) === '1';
  } catch {
    // Unreadable value: show the pages again instead of blocking the app.
    return false;
  }
}

export async function saveIntroSeen(userId: string): Promise<void> {
  await secureStorage.setItem(storageKey(userId), '1');
}

/** Forgets the flag of an account on this phone (after account deletion). */
export async function clearIntroSeen(userId: string): Promise<void> {
  await secureStorage.removeItem(storageKey(userId));
}
