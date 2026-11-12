import { nextUnseenWin, type CelebrationState } from './celebration-storage';
import type { Win } from './api';

function win(challengeId: string, settledAt: string): Win {
  return {
    challengeId,
    title: challengeId,
    mode: 'ranked',
    stakeCents: 1000,
    payoutCents: 1333,
    settledAt,
  };
}

const state: CelebrationState = { since: '2026-11-10T00:00:00Z', seen: ['seen'] };

describe('nextUnseenWin', () => {
  it('ignores wins from before the app first looked', () => {
    expect(nextUnseenWin([win('old', '2026-11-09T12:00:00Z')], state)).toBeUndefined();
  });

  it('ignores wins that were already celebrated', () => {
    expect(nextUnseenWin([win('seen', '2026-11-11T12:00:00Z')], state)).toBeUndefined();
  });

  it('returns the oldest unseen win first', () => {
    const wins = [win('b', '2026-11-12T12:00:00Z'), win('a', '2026-11-11T12:00:00Z')];
    expect(nextUnseenWin(wins, state)?.challengeId).toBe('a');
  });
});
