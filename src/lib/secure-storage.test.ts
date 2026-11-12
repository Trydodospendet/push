import * as SecureStore from 'expo-secure-store';

import { CHUNK_SIZE, secureStorage } from './secure-storage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

const { store } = jest.requireMock<{ store: Map<string, string> }>('expo-secure-store');

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('secureStorage', () => {
  it('returns null for unknown keys', async () => {
    expect(await secureStorage.getItem('session')).toBeNull();
  });

  it('round-trips a value that is larger than one chunk', async () => {
    const value = 'ä'.repeat(CHUNK_SIZE * 2 + 17);

    await secureStorage.setItem('session', value);

    expect(await secureStorage.getItem('session')).toBe(value);
    expect(store.get('session.count')).toBe('3');
  });

  it('never stores a chunk above the 2048-byte limit', async () => {
    await secureStorage.setItem('session', '€'.repeat(CHUNK_SIZE * 3));

    for (const [key, chunk] of store) {
      if (key !== 'session.count') {
        // Worst case for the limit: two bytes per character.
        expect(chunk.length * 2).toBeLessThanOrEqual(2048);
      }
    }
  });

  it('removes leftover chunks when a value shrinks', async () => {
    await secureStorage.setItem('session', 'x'.repeat(CHUNK_SIZE * 3));
    await secureStorage.setItem('session', 'short');

    expect(await secureStorage.getItem('session')).toBe('short');
    expect([...store.keys()].sort()).toEqual(['session.0', 'session.count']);
  });

  it('treats an incomplete value as missing', async () => {
    await secureStorage.setItem('session', 'x'.repeat(CHUNK_SIZE * 2));
    store.delete('session.1');

    expect(await secureStorage.getItem('session')).toBeNull();
  });

  it('removes every chunk', async () => {
    await secureStorage.setItem('session', 'x'.repeat(CHUNK_SIZE * 2));

    await secureStorage.removeItem('session');

    expect(store.size).toBe(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('session.count');
  });
});
