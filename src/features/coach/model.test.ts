import { coachStage, currentSpeed } from './model';
import type { TrackPoint } from '@/features/gps/geo';
const point = (t: number, lng: number): TrackPoint => ({
  lat: 52,
  lng,
  t,
  accuracy: 5,
  segment: 0,
  mocked: false,
  altitude: null,
});
test('growth slows down after the first active days', () => {
  expect([0, 1, 2, 6, 7, 29, 30, 89, 90].map(coachStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
});
test('speed requires fresh precise points in the same segment', () => {
  const a = point(1000, 13),
    b = point(3000, 13.00004);
  expect(currentSpeed([a, b], 4000)).toBeGreaterThan(0);
  expect(currentSpeed([a, b], 14000)).toBeNull();
  expect(currentSpeed([a, { ...b, segment: 1 }], 4000)).toBeNull();
  expect(currentSpeed([a, { ...b, mocked: true }], 4000)).toBeNull();
  expect(currentSpeed([a, { ...b, accuracy: 100 }], 4000)).toBeNull();
  expect(currentSpeed([a, a], 4000)).toBeNull();
});
