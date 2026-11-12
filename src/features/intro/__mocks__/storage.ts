/**
 * Manual Jest mock for './storage' (activate with `jest.mock('@/features/intro/storage')`).
 * By default the pages were already seen, so tests land where they expect to.
 */
let seen = true;

export const mockIntro = {
  set(next: boolean) {
    seen = next;
  },
  reset() {
    seen = true;
  },
};

export const loadIntroSeen = jest.fn(async (): Promise<boolean> => seen);
export const saveIntroSeen = jest.fn(async (): Promise<void> => undefined);
export const clearIntroSeen = jest.fn(async (): Promise<void> => undefined);
