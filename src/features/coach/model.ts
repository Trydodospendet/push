import type { TrackPoint } from '@/features/gps/geo';
import { haversineM } from '@/features/gps/geo';
export function coachStage(activeDays: number): number {
  return activeDays < 2 ? 0 : activeDays < 7 ? 1 : activeDays < 30 ? 2 : activeDays < 90 ? 3 : 4;
}
export function currentSpeed(points: readonly TrackPoint[], now: number): number | null {
  const b = points.at(-1);
  const a = points.at(-2);
  if (
    !a ||
    !b ||
    now - b.t > 10000 ||
    now < b.t ||
    a.segment !== b.segment ||
    a.mocked ||
    b.mocked ||
    a.accuracy > 25 ||
    b.accuracy > 25
  )
    return null;
  const seconds = (b.t - a.t) / 1000;
  if (seconds <= 0 || seconds > 10) return null;
  const speed = (haversineM(a.lat, a.lng, b.lat, b.lng) / seconds) * 3.6;
  return speed <= 43.2 ? speed : null;
}
