import { addDays } from '@/lib/dates';

/**
 * Training plans: pure data and rules, no server. A plan is a list of weeks; every week has two
 * or three runs (distance in metres) on fixed days. A run counts as done when a valid run of at
 * least 80 % of the planned distance exists in the same week (the order inside the week is free,
 * so a rest day can be moved).
 */
export type PlanId = 'start_4w' | '5k_8w' | '10k_10w';

export type PlanSession = {
  /** Local date 'YYYY-MM-DD'. */
  date: string;
  /** Week of the plan, starting with 1. */
  week: number;
  distanceM: number;
  /** "easy" runs are slow and relaxed; "long" is the longest of the week. */
  kind: 'easy' | 'long';
};

export type PlanTemplate = {
  id: PlanId;
  weeks: number;
  /** Kilometres of the runs of every week (the last is the long run), in metres. */
  weekly: readonly (readonly number[])[];
  /** Days of the week (0 = Monday) on which the runs of a week take place. */
  days: readonly number[];
};

const km = (...values: number[]): number[] => values.map((value) => Math.round(value * 1000));

export const PLANS: readonly PlanTemplate[] = [
  {
    id: 'start_4w',
    weeks: 4,
    days: [1, 3, 5],
    weekly: [km(1.5, 1.5, 2), km(2, 2, 2.5), km(2, 2.5, 3), km(2.5, 3, 3.5)],
  },
  {
    id: '5k_8w',
    weeks: 8,
    days: [1, 3, 5],
    weekly: [
      km(2, 2, 3),
      km(2.5, 2, 3.5),
      km(3, 2.5, 4),
      km(3, 3, 4),
      km(3.5, 3, 4.5),
      km(4, 3, 5),
      km(3, 3, 4),
      km(2.5, 2.5, 5),
    ],
  },
  {
    id: '10k_10w',
    weeks: 10,
    days: [1, 3, 5],
    weekly: [
      km(4, 3, 6),
      km(4, 4, 6),
      km(5, 4, 7),
      km(5, 4, 7),
      km(5, 5, 8),
      km(6, 4, 8),
      km(6, 5, 9),
      km(6, 5, 9),
      km(5, 4, 7),
      km(4, 3, 10),
    ],
  },
];

export function planById(id: string): PlanTemplate | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** All runs of a plan that starts on `startMonday` (a local date, the Monday of week 1). */
export function sessionsOf(plan: PlanTemplate, startMonday: string): PlanSession[] {
  const sessions: PlanSession[] = [];
  plan.weekly.forEach((distances, weekIndex) => {
    distances.forEach((distanceM, runIndex) => {
      sessions.push({
        date: addDays(startMonday, weekIndex * 7 + (plan.days[runIndex] ?? runIndex * 2)),
        week: weekIndex + 1,
        distanceM,
        kind: runIndex === distances.length - 1 ? 'long' : 'easy',
      });
    });
  });
  return sessions;
}

export type PlanWorkout = { localDate: string; distanceM: number; isValid: boolean };

export type SessionState = PlanSession & { done: boolean };

/** Share of the planned distance that a run must reach to count for a session. */
export const REQUIRED_SHARE = 0.8;

/**
 * Marks which sessions are done. Inside a week the longest valid runs are matched to the longest
 * sessions first, each run at most once.
 */
export function sessionStates(
  sessions: readonly PlanSession[],
  workouts: readonly PlanWorkout[],
  startMonday: string,
): SessionState[] {
  const done = new Set<PlanSession>();
  const weeks = new Set(sessions.map((session) => session.week));
  for (const week of weeks) {
    const from = addDays(startMonday, (week - 1) * 7);
    const to = addDays(from, 6);
    const runs = workouts
      .filter((run) => run.isValid && run.localDate >= from && run.localDate <= to)
      .map((run) => run.distanceM)
      .sort((a, b) => b - a);
    const planned = sessions
      .filter((session) => session.week === week)
      .sort((a, b) => b.distanceM - a.distanceM);
    for (const session of planned) {
      const index = runs.findIndex((distance) => distance >= session.distanceM * REQUIRED_SHARE);
      if (index >= 0) {
        runs.splice(index, 1);
        done.add(session);
      }
    }
  }
  return sessions.map((session) => ({ ...session, done: done.has(session) }));
}

/** Monday on or after the given local date (plans start on a Monday). */
export function nextMonday(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7; // 0 = Monday
  return weekday === 0 ? today : addDays(today, 7 - weekday);
}
