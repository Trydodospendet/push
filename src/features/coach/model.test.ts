import { coachStage, isNight } from './model';
test('growth slows down after the first active days', () => {
  expect([0, 1, 2, 6, 7, 29, 30, 89, 90].map(coachStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
});

describe('isNight', () => {
  it('covers the night only', () => {
    expect([22, 23, 0, 5].every(isNight)).toBe(true);
    expect([6, 12, 21].some(isNight)).toBe(false);
  });
});
