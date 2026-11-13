import type { FeedEntry } from './api';
import { feedSentence } from './feed-text';

const base: FeedEntry = {
  id: '1',
  kind: 'joined',
  displayName: 'Anna',
  isMine: false,
  distanceM: null,
  createdAt: '2026-11-16T10:00:00Z',
  cheerCount: 0,
  cheeredByMe: false,
};

describe('feedSentence', () => {
  it('describes what others did', () => {
    expect(feedSentence(base)).toBe('Anna ist beigetreten');
    expect(feedSentence({ ...base, kind: 'ran', distanceM: 5200 })).toBe(
      'Anna ist 5,2 km gelaufen',
    );
    expect(feedSentence({ ...base, kind: 'goal_reached' })).toBe('Anna hat das Ziel erreicht');
  });

  it('talks to me for my own entries', () => {
    expect(feedSentence({ ...base, isMine: true })).toBe('Du bist beigetreten');
    expect(feedSentence({ ...base, isMine: true, kind: 'ran', distanceM: 10000 })).toBe(
      'Du bist 10 km gelaufen',
    );
    expect(feedSentence({ ...base, isMine: true, kind: 'goal_reached' })).toBe(
      'Du hast das Ziel erreicht',
    );
  });
});
