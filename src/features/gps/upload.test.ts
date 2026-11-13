import { secureStorage } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';

import type { TrackPoint } from './geo';
import {
  clearGpsStorage,
  enqueueRun,
  listQueuedRuns,
  loadActiveRun,
  saveActiveRun,
} from './storage';
import { uploadQueuedRuns } from './upload';

jest.mock('@/lib/supabase');

/** In-mockMemory replacement for the encrypted device storage. */
const mockMemory = new Map<string, string>();
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockMemory.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockMemory.delete(key);
    }),
  },
}));

const points: TrackPoint[] = Array.from({ length: 12 }, (_, i) => ({
  lat: 52.5 + i * 0.0001,
  lng: 13.4,
  t: 1_700_000_000_000 + i * 3000,
  accuracy: 5,
  segment: 0,
  mocked: false,
  altitude: null,
}));

const rpc = jest.mocked(supabase.rpc);

function answer(result: { data: unknown; error: { message: string } | null }) {
  rpc.mockResolvedValueOnce(result as never);
}

describe('GPS storage and upload', () => {
  beforeEach(() => {
    mockMemory.clear();
    rpc.mockReset();
    jest.mocked(secureStorage.getItem).mockClear();
  });

  it('keeps the run in progress per account', async () => {
    await saveActiveRun('user-1', 'run-1', points);
    const stored = await loadActiveRun('user-1');
    expect(stored?.runId).toBe('run-1');
    expect(stored?.points).toHaveLength(12);
    await expect(loadActiveRun('user-2')).resolves.toBeNull();
  });

  it('drops a damaged checkpoint instead of failing', async () => {
    mockMemory.set('push.gps.active.user-1', 'not json');
    await expect(loadActiveRun('user-1')).resolves.toBeNull();
  });

  it('uploads a queued run and takes it out of the queue', async () => {
    await enqueueRun('user-1', 'run-1', points);
    answer({
      data: [
        { run_id: 'x', distance_m: 3600, duration_s: 1200, is_valid: true, invalid_reason: null },
      ],
      error: null,
    });

    const uploaded = await uploadQueuedRuns('user-1');

    expect(uploaded).toEqual([
      { runId: 'run-1', distanceM: 3600, durationS: 1200, isValid: true, invalidReason: null },
    ]);
    expect(rpc).toHaveBeenCalledWith(
      'sync_gps_run',
      expect.objectContaining({
        p_run: expect.objectContaining({ client_run_id: 'run-1' }) as unknown,
      }),
    );
    await expect(listQueuedRuns('user-1')).resolves.toEqual([]);
  });

  it('keeps a run in the queue while the connection is missing', async () => {
    await enqueueRun('user-1', 'run-1', points);
    answer({ data: null, error: { message: 'Failed to fetch' } });

    await expect(uploadQueuedRuns('user-1')).resolves.toEqual([]);
    await expect(listQueuedRuns('user-1')).resolves.toHaveLength(1);
  });

  it('removes a run the server can never accept', async () => {
    await enqueueRun('user-1', 'run-1', points);
    answer({ data: null, error: { message: 'invalid_gps_payload' } });

    await expect(uploadQueuedRuns('user-1')).resolves.toEqual([]);
    await expect(listQueuedRuns('user-1')).resolves.toEqual([]);
  });

  it('shows the verdict for a run the server rejected', async () => {
    await enqueueRun('user-1', 'run-1', points);
    answer({
      data: [
        {
          run_id: 'x',
          distance_m: 3600,
          duration_s: 1200,
          is_valid: false,
          invalid_reason: 'mock_location',
        },
      ],
      error: null,
    });

    const [result] = await uploadQueuedRuns('user-1');
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe('mock_location');
  });

  it('forgets everything of an account', async () => {
    await enqueueRun('user-1', 'run-1', points);
    await saveActiveRun('user-1', 'run-2', points);
    await clearGpsStorage('user-1');
    expect(mockMemory.size).toBe(0);
  });
});
