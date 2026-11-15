import { coachStage } from './model';
test('growth slows down after the first active days', () => {
  expect([0, 1, 2, 6, 7, 29, 30, 89, 90].map(coachStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
});
