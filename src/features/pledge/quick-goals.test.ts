import { QUICK_GOALS } from '@/config/app';

import { quickGoalDates, quickGoalTarget, quickGoalTitle } from './quick-goals';

describe('quick goals', () => {
  it('runs a day goal from today until today', () => {
    expect(quickGoalDates('2026-11-16', 'today')).toEqual({
      first: '2026-11-16',
      last: '2026-11-16',
    });
  });

  it('runs a week goal from today until Sunday', () => {
    // 2026-11-16 is a Monday, 2026-11-22 the Sunday of that week.
    expect(quickGoalDates('2026-11-16', 'week')).toEqual({
      first: '2026-11-16',
      last: '2026-11-22',
    });
    expect(quickGoalDates('2026-11-22', 'week').last).toBe('2026-11-22');
  });

  it('describes the three suggestions of Home', () => {
    expect(QUICK_GOALS.map(quickGoalTarget)).toEqual(['3 km', '8.000 Schritte', '10 km']);
    expect(QUICK_GOALS.map(quickGoalTitle)).toEqual([
      '3 km laufen · heute',
      '8.000 Schritte täglich · heute',
      '10 km laufen · diese Woche',
    ]);
  });
});
