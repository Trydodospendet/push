import { dayStart, eligibleOrigins, healthDays } from './days';

describe('dayStart', () => {
  it('is local midnight in the profile timezone (winter time)', () => {
    expect(dayStart('2026-11-14', 'Europe/Berlin').toISOString()).toBe('2026-11-13T23:00:00.000Z');
  });

  it('is local midnight in the profile timezone (summer time)', () => {
    expect(dayStart('2026-07-14', 'Europe/Berlin').toISOString()).toBe('2026-07-13T22:00:00.000Z');
  });

  it('does not depend on the phone: other timezones give other instants', () => {
    expect(dayStart('2026-11-14', 'America/New_York').toISOString()).toBe(
      '2026-11-14T05:00:00.000Z',
    );
  });

  it('handles the day the clocks change', () => {
    const start = dayStart('2026-10-25', 'Europe/Berlin');
    const next = dayStart('2026-10-26', 'Europe/Berlin');
    expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});

describe('healthDays', () => {
  const now = new Date('2026-11-14T10:30:00Z');

  it('returns the last 45 local days, today last', () => {
    const days = healthDays('Europe/Berlin', now);
    expect(days).toHaveLength(45);
    expect(days[44].date).toBe('2026-11-14');
    expect(days[0].date).toBe('2026-10-01');
  });

  it('cuts today at the current time so the range never reaches into the future', () => {
    const today = healthDays('Europe/Berlin', now)[44];
    expect(today.start.toISOString()).toBe('2026-11-13T23:00:00.000Z');
    expect(today.end.toISOString()).toBe(now.toISOString());
  });

  it('drops days that begin before the earliest readable instant', () => {
    const earliest = new Date('2026-11-10T12:00:00Z');
    const days = healthDays('Europe/Berlin', now, earliest);
    expect(days.map((day) => day.date)).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);
  });
});

describe('eligibleOrigins', () => {
  it('excludes a source with manual entries for the whole day, keeps the others', () => {
    const result = eligibleOrigins([
      { metadata: { dataOrigin: 'app.watch', recordingMethod: 2 } },
      { metadata: { dataOrigin: 'app.manual', recordingMethod: 3 } },
      { metadata: { dataOrigin: 'app.manual', recordingMethod: 2 } },
      { metadata: { dataOrigin: 'app.phone', recordingMethod: 0 } },
    ]);
    expect(result.origins.sort()).toEqual(['app.phone', 'app.watch']);
    expect(result.excluded).toBe(1);
  });

  it('returns no origins when every source has manual entries', () => {
    expect(
      eligibleOrigins([{ metadata: { dataOrigin: 'app.manual', recordingMethod: 3 } }]),
    ).toEqual({ origins: [], excluded: 1 });
  });

  it('refuses records without a source because manual entries could hide in them', () => {
    expect(() => eligibleOrigins([{ metadata: {} }])).toThrow('health_missing_origin');
    expect(() => eligibleOrigins([{}])).toThrow('health_missing_origin');
  });
});
