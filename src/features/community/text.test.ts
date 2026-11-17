import { agoText, eventText } from './text';

describe('community texts', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');

  it('describes events without a person', () => {
    expect(eventText({ kind: 'run', goalType: null, value: 5, at: '2026-11-17T11:00:00Z' })).toBe(
      'Jemand ist 5 km gelaufen',
    );
    expect(
      eventText({ kind: 'goal', goalType: 'run_single', value: 5000, at: '2026-11-17T11:00:00Z' }),
    ).toBe('Jemand hat 5 km geschafft');
    expect(
      eventText({
        kind: 'goal',
        goalType: 'steps_daily',
        value: 10000,
        at: '2026-11-17T11:00:00Z',
      }),
    ).toBe('Jemand hat 10.000 Schritte geschafft');
  });

  it('shows how long ago it happened', () => {
    expect(agoText('2026-11-17T11:55:00Z', now)).toBe('gerade eben');
    expect(agoText('2026-11-17T11:35:00Z', now)).toBe('vor 25 Min.');
    expect(agoText('2026-11-17T09:00:00Z', now)).toBe('vor 3 Std.');
  });
});
