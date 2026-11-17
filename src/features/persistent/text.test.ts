import { goalText, runText } from './text';

describe('persistent progress text', () => {
  it('shows what is left for a single run', () => {
    expect(
      goalText({ goalType: 'run_single', targetValue: 3000, progress: 1200, stepsToday: 0 }),
    ).toBe('3 km am Stück: noch 1,8 km');
  });

  it('shows what is left for a run total', () => {
    expect(
      goalText({ goalType: 'run_total', targetValue: 10000, progress: 4000, stepsToday: 0 }),
    ).toBe('10 km insgesamt: noch 6 km');
  });

  it('shows the steps of today for a daily step goal', () => {
    expect(
      goalText({ goalType: 'steps_daily', targetValue: 10000, progress: 0, stepsToday: 6240 }),
    ).toBe('6.240 / 10.000 Schritte heute');
  });

  it('says so when the goal is reached', () => {
    expect(
      goalText({ goalType: 'run_single', targetValue: 3000, progress: 3100, stepsToday: 0 }),
    ).toBe('Ziel geschafft!');
  });

  it('shows the distance of a run in progress', () => {
    expect(runText(1240)).toBe('Lauf: 1,24 km');
  });
});
