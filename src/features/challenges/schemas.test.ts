import { createChallengeSchema, inviteCodeSchema, lastDayOf } from './schemas';

const today = '2026-11-13';
const schema = createChallengeSchema(today);

const valid = {
  title: '5 km am Stück',
  goalType: 'run_single',
  targetValue: 5000,
  stakeCents: 1000,
  startDate: '2026-11-14',
  durationDays: 7,
  visibility: 'public',
} as const;

describe('createChallengeSchema (same limits as public.create_challenge)', () => {
  it('accepts a valid challenge and trims the title', () => {
    const result = schema.safeParse({ ...valid, title: '  5 km am Stück ' });
    expect(result.success && result.data.title).toBe('5 km am Stück');
  });

  it.each([
    ['title too short', { title: 'ab' }],
    ['title too long', { title: 'x'.repeat(61) }],
    ['unknown goal type', { goalType: 'swim' }],
    ['run below 1 km', { targetValue: 999 }],
    ['single run above 100 km', { targetValue: 100_001 }],
    ['steps above 50,000', { goalType: 'steps_daily', targetValue: 50_001 }],
    ['stake below 1.00', { stakeCents: 99 }],
    ['stake above 50.00', { stakeCents: 5001 }],
    ['stake with fractions', { stakeCents: 100.5 }],
    ['start today', { startDate: today }],
    ['start in 31 days', { startDate: '2026-12-14' }],
    ['duration 0 days', { durationDays: 0 }],
    ['duration 43 days', { durationDays: 43 }],
    ['unknown visibility', { visibility: 'secret' }],
  ])('rejects %s', (_reason, override) => {
    expect(schema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('accepts the boundaries', () => {
    expect(schema.safeParse({ ...valid, stakeCents: 100, durationDays: 1 }).success).toBe(true);
    expect(
      schema.safeParse({ ...valid, stakeCents: 5000, durationDays: 42, startDate: '2026-12-13' })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...valid, goalType: 'run_total', targetValue: 500_000 }).success,
    ).toBe(true);
  });
});

describe('lastDayOf', () => {
  it('returns the last day included in the challenge', () => {
    expect(lastDayOf('2026-11-14', 1)).toBe('2026-11-14');
    expect(lastDayOf('2026-11-14', 7)).toBe('2026-11-20');
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
