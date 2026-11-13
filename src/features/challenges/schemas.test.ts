import { createGoalSchema, goalPeriodDays, inviteCodeSchema } from './schemas';

const valid = {
  title: '5 km diese Woche',
  goalType: 'run_total',
  targetValue: 5000,
  stakeCents: 1000,
  period: 'week',
} as const;

describe('createGoalSchema (same limits as public.create_goal)', () => {
  it('accepts a valid goal and trims the title', () => {
    const result = createGoalSchema.safeParse({ ...valid, title: '  5 km diese Woche ' });
    expect(result.success && result.data.title).toBe('5 km diese Woche');
  });

  it.each([
    ['title too short', { title: 'ab' }],
    ['title too long', { title: 'x'.repeat(61) }],
    ['unknown goal type', { goalType: 'swim' }],
    ['run below 1 km', { targetValue: 999 }],
    ['single run above 100 km', { goalType: 'run_single', targetValue: 100_001 }],
    ['steps above 50,000', { goalType: 'steps_daily', targetValue: 50_001 }],
    ['stake below 1.00', { stakeCents: 99 }],
    ['stake above 50.00', { stakeCents: 5001 }],
    ['stake with fractions', { stakeCents: 100.5 }],
    ['unknown period', { period: 'year' }],
  ])('rejects %s', (_reason, override) => {
    expect(createGoalSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('accepts the boundaries', () => {
    expect(createGoalSchema.safeParse({ ...valid, stakeCents: 100, period: 'day' }).success).toBe(
      true,
    );
    expect(
      createGoalSchema.safeParse({ ...valid, stakeCents: 5000, period: 'month' }).success,
    ).toBe(true);
    expect(createGoalSchema.safeParse({ ...valid, targetValue: 500_000 }).success).toBe(true);
  });
});

describe('goalPeriodDays (same rules as the server)', () => {
  it('starts a day goal today and ends it today', () => {
    expect(goalPeriodDays('2026-11-13', 'day')).toEqual({
      first: '2026-11-13',
      last: '2026-11-13',
    });
  });

  it('starts a week goal on the coming Monday, also from a Monday or a Sunday', () => {
    // 2026-11-13 is a Friday.
    expect(goalPeriodDays('2026-11-13', 'week')).toEqual({
      first: '2026-11-16',
      last: '2026-11-22',
    });
    // Monday 2026-11-16 → the Monday after.
    expect(goalPeriodDays('2026-11-16', 'week')).toEqual({
      first: '2026-11-23',
      last: '2026-11-29',
    });
    // Sunday 2026-11-15 → tomorrow.
    expect(goalPeriodDays('2026-11-15', 'week')).toEqual({
      first: '2026-11-16',
      last: '2026-11-22',
    });
  });

  it('uses the next calendar month, also at the end of the year and in leap years', () => {
    expect(goalPeriodDays('2026-11-13', 'month')).toEqual({
      first: '2026-12-01',
      last: '2026-12-31',
    });
    expect(goalPeriodDays('2026-12-31', 'month')).toEqual({
      first: '2027-01-01',
      last: '2027-01-31',
    });
    expect(goalPeriodDays('2028-01-20', 'month')).toEqual({
      first: '2028-02-01',
      last: '2028-02-29',
    });
  });
});

describe('inviteCodeSchema', () => {
  it('normalises the code', () => {
    expect(inviteCodeSchema.parse(' lauf26 ')).toBe('LAUF26');
  });

  it.each(['LAUF2', 'LAUF267', 'LAUF-2'])('rejects %p', (code) => {
    expect(inviteCodeSchema.safeParse(code).success).toBe(false);
  });
});
