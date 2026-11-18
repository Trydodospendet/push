import { hasRunGoal } from './run-goal';
import type { MyChallenge } from './types';

const NOW = Date.parse('2026-11-18T12:00:00Z');

function goal(patch: Partial<MyChallenge>): MyChallenge {
  return {
    isParticipant: true,
    goal_type: 'run_total',
    status: 'active',
    ends_at: '2026-11-19T00:00:00Z',
    ...patch,
  } as MyChallenge;
}

describe('hasRunGoal', () => {
  it('is true for a running run goal', () => {
    expect(hasRunGoal([goal({})], NOW)).toBe(true);
  });

  it('is false without goals, for steps goals and for goals that are over', () => {
    expect(hasRunGoal([], NOW)).toBe(false);
    expect(hasRunGoal([goal({ goal_type: 'steps_daily' })], NOW)).toBe(false);
    expect(hasRunGoal([goal({ ends_at: '2026-11-18T11:00:00Z' })], NOW)).toBe(false);
    expect(hasRunGoal([goal({ status: 'settled' })], NOW)).toBe(false);
  });

  it('ignores goals the user did not join', () => {
    expect(hasRunGoal([goal({ isParticipant: false })], NOW)).toBe(false);
  });
});
