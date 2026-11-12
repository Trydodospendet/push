import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store only guarantees values up to 2048 bytes, and a Supabase session is
 * usually larger. Values are therefore split into chunks that are stored under
 * `<key>.0`, `<key>.1`, … with the number of chunks under `<key>.count`.
 *
 * 1000 characters stay below 2048 bytes even if every character needed two bytes.
 */
export const CHUNK_SIZE = 1000;

function countKey(key: string): string {
  return `${key}.count`;
}

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const count = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function removeChunks(key: string, fromIndex: number, toIndex: number): Promise<void> {
  for (let index = fromIndex; index < toIndex; index += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, index));
  }
}

/** Storage adapter in the shape supabase-js expects (`auth.storage`). */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readCount(key);
    if (count === 0) {
      return null;
    }

    const chunks: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, index));
      if (chunk === null) {
        // Incomplete value (e.g. the app was killed while writing): treat as missing.
        return null;
      }
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readCount(key);
    const chunkCount = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));

    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(chunkKey(key, index), chunk);
    }
    await SecureStore.setItemAsync(countKey(key), String(chunkCount));
    await removeChunks(key, chunkCount, previousCount);
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    await SecureStore.deleteItemAsync(countKey(key));
    await removeChunks(key, 0, count);
  },
};
