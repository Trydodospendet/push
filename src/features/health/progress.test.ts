import { pickPrimaryChallenge, progressNumbers, progressRatio, remainingLabel } from './progress';

describe('progressNumbers', () => {
  it('shows runs in kilometres with two decimals', () => {
    expect(progressNumbers('run_single', 3250, 5000, 7)).toEqual({
      current: '3,25',
      goal: '5,00',
      unit: 'km',
      spoken: '3,25 von 5,00 km',
    });
    expect(progressNumbers('run_total', 0, 21100, 14).goal).toBe('21,10');
  });

  it('shows steps_daily as reached days of all days', () => {
    expect(progressNumbers('steps_daily', 3, 10000, 7)).toEqual({
      current: '3',
      goal: '7',
      unit: 'Tage geschafft',
      spoken: '3 von 7 Tage geschafft',
    });
  });
});

describe('steps_total (most steps)', () => {
  it('shows the steps so far against the target in steps', () => {
    expect(progressNumbers('steps_total', 23_500, 70_000, 7)).toEqual({
      current: '23.500',
      goal: '70.000',
      unit: 'Schritte',
      spoken: '23.500 von 70.000 Schritte',
    });
    expect(progressRatio('steps_total', 35_000, 70_000, 7)).toBe(0.5);
  });
});

describe('progressRatio', () => {
  it('relates runs to the target and steps_daily to the number of days', () => {
    expect(progressRatio('run_single', 2500, 5000, 7)).toBe(0.5);
    expect(progressRatio('steps_daily', 3, 10000, 6)).toBe(0.5);
  });

  it('stays between 0 and 1', () => {
    expect(progressRatio('run_total', 99000, 5000, 7)).toBe(1);
    expect(progressRatio('run_total', -5, 5000, 7)).toBe(0);
    expect(progressRatio('steps_daily', 1, 10000, 0)).toBe(0);
  });
});

describe('remainingLabel', () => {
  const now = new Date('2026-11-14T10:00:00Z');
  const after = (ms: number) => new Date(now.getTime() + ms);
  const hour = 3_600_000;

  it('counts days, hours and minutes', () => {
    expect(remainingLabel(after(3 * 24 * hour + hour), now)).toBe('Noch 3 Tage');
    expect(remainingLabel(after(30 * hour), now)).toBe('Noch 30 Stunden');
    expect(remainingLabel(after(hour), now)).toBe('Noch 1 Stunde');
    expect(remainingLabel(after(5 * 60_000), now)).toBe('Noch 5 Minuten');
    expect(remainingLabel(after(10_000), now)).toBe('Noch 1 Minute');
  });

  it('says so when the period is over', () => {
    expect(remainingLabel(after(-1), now)).toBe('Zeitraum beendet');
  });
});

describe('pickPrimaryChallenge', () => {
  it('prefers running over ending over open challenges, then the earliest start', () => {
    const open = { id: 'open', status: 'open', starts_at: '2026-11-15T00:00:00Z' };
    const settling = { id: 'settling', status: 'settling', starts_at: '2026-11-01T00:00:00Z' };
    const lateActive = { id: 'late', status: 'active', starts_at: '2026-11-13T00:00:00Z' };
    const earlyActive = { id: 'early', status: 'active', starts_at: '2026-11-10T00:00:00Z' };
    expect(pickPrimaryChallenge([open, settling, lateActive, earlyActive])?.id).toBe('early');
    expect(pickPrimaryChallenge([open, settling])?.id).toBe('settling');
    expect(pickPrimaryChallenge([open])?.id).toBe('open');
  });

  it('ignores finished challenges and handles an empty list', () => {
    expect(pickPrimaryChallenge([{ status: 'settled', starts_at: '2026-11-01T00:00:00Z' }])).toBe(
      undefined,
    );
    expect(pickPrimaryChallenge([])).toBe(undefined);
  });
});
