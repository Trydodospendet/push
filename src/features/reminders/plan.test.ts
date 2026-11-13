import { planReminders, type ReminderChallenge, type ReminderSettings } from './plan';

const settings: ReminderSettings = { enabled: true, hour: 18, minute: 0 };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Local noon, so the 18:00 reminder is still ahead on the first day.
const now = new Date(2026, 10, 16, 12, 0, 0);

function challenge(overrides: Partial<ReminderChallenge> = {}): ReminderChallenge {
  return {
    id: 'c1',
    title: '10 km diese Woche',
    goalType: 'run_total',
    targetValue: 10_000,
    status: 'active',
    startsAt: new Date(now.getTime() - DAY).toISOString(),
    endsAt: new Date(now.getTime() + 5 * DAY).toISOString(),
    syncGraceHours: 24,
    ...overrides,
  };
}

describe('planReminders', () => {
  it('plans nothing when reminders are off', () => {
    expect(planReminders([challenge()], {}, { ...settings, enabled: false }, now)).toEqual([]);
  });

  it('plans a daily reminder with the remaining distance', () => {
    const plan = planReminders([challenge()], { c1: 7_700 }, settings, now);
    const daily = plan.filter((entry) => entry.key.startsWith('daily-'));
    expect(daily).toHaveLength(3);
    expect(daily[0].body).toBe('Noch 2,3 km bis zum Ziel.');
    expect(daily[0].at.getHours()).toBe(18);
    expect(daily[0].at.getMinutes()).toBe(0);
  });

  it('skips the daily reminder once a run goal is reached', () => {
    const plan = planReminders([challenge()], { c1: 10_000 }, settings, now);
    expect(plan.filter((entry) => entry.key.startsWith('daily-'))).toEqual([]);
  });

  it('does not plan reminders after the challenge ended', () => {
    const plan = planReminders(
      [challenge({ endsAt: new Date(now.getTime() + 2 * HOUR).toISOString() })],
      {},
      settings,
      now,
    );
    expect(plan.filter((entry) => entry.key.startsWith('daily-'))).toEqual([]);
  });

  it('reminds about open step days without a distance', () => {
    const plan = planReminders(
      [challenge({ goalType: 'steps_daily', targetValue: 10_000 })],
      {},
      settings,
      now,
    );
    expect(plan[0].body).toBe('Dein Tagesziel von 10.000 Schritten ist noch offen.');
  });

  it('announces a start on the day before at the reminder time', () => {
    const startsAt = new Date(2026, 10, 18, 0, 0, 0);
    const plan = planReminders(
      [challenge({ status: 'open', startsAt: startsAt.toISOString() })],
      {},
      settings,
      now,
    );
    const start = plan.find((entry) => entry.key === 'start-c1');
    expect(start?.body).toBe('Deine Challenge startet morgen.');
    expect(start?.at).toEqual(new Date(2026, 10, 17, 18, 0, 0));
  });

  it('does not announce a start that begins before the next reminder time', () => {
    const startsAt = new Date(2026, 10, 16, 15, 0, 0);
    const plan = planReminders(
      [challenge({ status: 'open', startsAt: startsAt.toISOString() })],
      {},
      settings,
      now,
    );
    expect(plan.find((entry) => entry.key === 'start-c1')).toBeUndefined();
  });

  it('announces the result after end and grace period', () => {
    const ch = challenge();
    const plan = planReminders([ch], {}, settings, now);
    const result = plan.find((entry) => entry.key === 'result-c1');
    expect(result?.body).toBe('Dein Ergebnis ist da.');
    expect(result?.at.getTime()).toBe(Date.parse(ch.endsAt) + 24 * HOUR + 10 * 60_000);
  });

  it('plans nothing for settled challenges and sorts by time', () => {
    expect(planReminders([challenge({ status: 'settled' })], {}, settings, now)).toEqual([]);
    const plan = planReminders([challenge()], {}, settings, now);
    const times = plan.map((entry) => entry.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
