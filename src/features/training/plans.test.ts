import { nextMonday, PLANS, planById, sessionsOf, sessionStates } from './plans';

describe('plans', () => {
  it('have the promised length and three runs per week', () => {
    for (const plan of PLANS) {
      expect(plan.weekly).toHaveLength(plan.weeks);
      plan.weekly.forEach((week) => expect(week).toHaveLength(3));
    }
    expect(planById('5k_8w')?.weeks).toBe(8);
    expect(planById('nope')).toBeUndefined();
  });

  it('end at the goal: the long run of the last week is the goal distance', () => {
    expect(
      PLANS.find((plan) => plan.id === '5k_8w')
        ?.weekly.at(-1)
        ?.at(-1),
    ).toBe(5000);
    expect(
      PLANS.find((plan) => plan.id === '10k_10w')
        ?.weekly.at(-1)
        ?.at(-1),
    ).toBe(10000);
  });
});

describe('sessionsOf', () => {
  it('places the runs on Tuesday, Thursday and Saturday of every week', () => {
    const plan = planById('5k_8w');
    if (!plan) throw new Error('plan');
    const sessions = sessionsOf(plan, '2026-11-16');
    expect(sessions).toHaveLength(24);
    expect(sessions.slice(0, 3).map((session) => session.date)).toEqual([
      '2026-11-17',
      '2026-11-19',
      '2026-11-21',
    ]);
    expect(sessions[2]).toMatchObject({ week: 1, distanceM: 3000, kind: 'long' });
    expect(sessions[3].date).toBe('2026-11-24');
  });
});

describe('sessionStates', () => {
  const plan = planById('5k_8w');
  if (!plan) throw new Error('plan');
  const sessions = sessionsOf(plan, '2026-11-16').filter((session) => session.week === 1);
  const run = (localDate: string, distanceM: number, isValid = true) => ({
    localDate,
    distanceM,
    isValid,
  });

  it('counts a run of at least 80 % of the planned distance', () => {
    const states = sessionStates(sessions, [run('2026-11-17', 1600)], '2026-11-16');
    expect(states.map((state) => state.done)).toEqual([true, false, false]);
  });

  it('lets a rest day move inside the week and uses every run once', () => {
    const states = sessionStates(
      sessions,
      [run('2026-11-22', 3200), run('2026-11-18', 2100)],
      '2026-11-16',
    );
    expect(states.filter((state) => state.done)).toHaveLength(2);
    expect(states.find((state) => state.kind === 'long')?.done).toBe(true);
  });

  it('ignores invalid runs, short runs and runs of other weeks', () => {
    const states = sessionStates(
      sessions,
      [run('2026-11-17', 3000, false), run('2026-11-19', 1000), run('2026-11-26', 5000)],
      '2026-11-16',
    );
    expect(states.some((state) => state.done)).toBe(false);
  });
});

describe('nextMonday', () => {
  it.each([
    ['2026-11-16', '2026-11-16'],
    ['2026-11-17', '2026-11-23'],
    ['2026-11-22', '2026-11-23'],
  ])('%s → %s', (today, expected) => {
    expect(nextMonday(today)).toBe(expected);
  });
});
