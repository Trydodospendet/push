import * as StoreReview from 'expo-store-review';

import { secureStorage } from '@/lib/secure-storage';

import { afterAsking, MAX_ASKS, shouldAskForReview, type ReviewState } from './policy';
import { maybeAskForReview } from './review';

jest.mock('@/lib/secure-storage');
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));

const store = jest.mocked(secureStorage);
const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-12-01T12:00:00Z');
const old = (days: number) => new Date(now.getTime() - days * DAY).toISOString();

const base: ReviewState = { lastAskedAt: null, count: 0, firstSeenAt: old(10) };

describe('shouldAskForReview', () => {
  it('asks after a win when the app has been used for a few days', () => {
    expect(shouldAskForReview(base, now, 'win')).toBe(true);
  });

  it('does not ask in the first days', () => {
    expect(shouldAskForReview({ ...base, firstSeenAt: old(2) }, now, 'win')).toBe(false);
  });

  it('asks rarely: not within 90 days of the last question', () => {
    expect(shouldAskForReview({ ...base, lastAskedAt: old(30), count: 1 }, now, 'record')).toBe(
      false,
    );
    expect(shouldAskForReview({ ...base, lastAskedAt: old(91), count: 1 }, now, 'record')).toBe(
      true,
    );
  });

  it('stops after a few questions', () => {
    expect(
      shouldAskForReview({ ...base, lastAskedAt: old(400), count: MAX_ASKS }, now, 'win'),
    ).toBe(false);
  });

  it('counts a question', () => {
    expect(afterAsking(base, now)).toEqual({ ...base, lastAskedAt: now.toISOString(), count: 1 });
  });
});

describe('maybeAskForReview', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
    jest.mocked(StoreReview.requestReview).mockClear();
    jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(true);
  });

  it('shows the system dialog and remembers it', async () => {
    store.getItem.mockResolvedValue(JSON.stringify(base));
    await expect(maybeAskForReview('win', now)).resolves.toBe(true);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.setItem.mock.calls[0][1])).toMatchObject({ count: 1 });
  });

  it('does nothing when the rules say no or the system cannot show it', async () => {
    store.getItem.mockResolvedValue(JSON.stringify({ ...base, count: MAX_ASKS }));
    await expect(maybeAskForReview('win', now)).resolves.toBe(false);

    store.getItem.mockResolvedValue(JSON.stringify(base));
    jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(false);
    await expect(maybeAskForReview('win', now)).resolves.toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
