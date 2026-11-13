import {
  challengeDays,
  describeGoal,
  formatFee,
  formatPeriod,
  formatTarget,
  isFinished,
  isJoinable,
  modeLabel,
  statusLabel,
  suggestTitle,
} from './format';

describe('modes and fees', () => {
  it('labels the two modes', () => {
    expect(modeLabel('pool')).toBe('Pool');
    expect(modeLabel('ranked')).toBe('Ranked');
  });

  it.each([
    [1000, '10 %'],
    [250, '2,5 %'],
    [0, '0 %'],
  ])('formats %p basis points as %p', (bps, expected) => {
    expect(formatFee(bps).replace(/\s/g, ' ')).toBe(expected);
  });

  it('treats settled and cancelled challenges as finished', () => {
    expect(isFinished({ status: 'settled' })).toBe(true);
    expect(isFinished({ status: 'cancelled' })).toBe(true);
    expect(isFinished({ status: 'settling' })).toBe(false);
  });
});

describe('goal formatting', () => {
  it.each([
    ['run_single', 5000, '5 km'],
    ['run_total', 21100, '21,1 km'],
    ['steps_daily', 10000, '10.000 Schritte'],
  ] as const)('formats %s %p as %p', (goalType, value, expected) => {
    expect(formatTarget(goalType, value)).toBe(expected);
  });

  it('describes each goal type in plain German', () => {
    expect(describeGoal('run_single', 5000)).toBe('Ein Lauf über mindestens 5 km');
    expect(describeGoal('run_total', 21100)).toBe('Insgesamt 21,1 km laufen');
    expect(describeGoal('steps_daily', 8000)).toBe('Jeden Tag 8.000 Schritte');
    expect(describeGoal('unknown', 1)).toBe('');
  });

  it('suggests a title from the goal', () => {
    expect(suggestTitle('run_single', 10000)).toBe('10 km am Stück');
    expect(suggestTitle('steps_daily', 12000)).toBe('12.000 Schritte täglich');
  });
});

describe('challenge period', () => {
  // Created for start date 2026-11-14 and 7 days in Europe/Berlin (UTC+1).
  const challenge = {
    starts_at: '2026-11-13T23:00:00+00:00',
    ends_at: '2026-11-20T23:00:00+00:00',
    timezone: 'Europe/Berlin',
  };

  it('shows the first and the last local day (ends_at is the midnight after it)', () => {
    expect(challengeDays(challenge)).toEqual({
      firstDay: '2026-11-14',
      lastDay: '2026-11-20',
      days: 7,
    });
    expect(formatPeriod(challenge)).toBe('Sa., 14.11. – Fr., 20.11.');
  });

  it('shows a single day for one-day challenges', () => {
    expect(formatPeriod({ ...challenge, ends_at: '2026-11-14T23:00:00+00:00' })).toBe(
      'Sa., 14.11.',
    );
  });
});

describe('status', () => {
  it('translates the status', () => {
    expect(statusLabel('open')).toBe('Offen');
    expect(statusLabel('settling')).toBe('Wird ausgewertet');
  });

  it('allows joining only while open and before the start', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    expect(isJoinable({ status: 'open', starts_at: '2026-11-13T23:00:00Z' }, now)).toBe(true);
    expect(isJoinable({ status: 'open', starts_at: '2026-11-13T11:00:00Z' }, now)).toBe(false);
    expect(isJoinable({ status: 'active', starts_at: '2026-11-13T23:00:00Z' }, now)).toBe(false);
  });
});
