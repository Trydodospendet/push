import { haversineM, JUMP_SPEED_MS, type TrackPoint } from './geo';

type SpeedFix = Pick<TrackPoint, 'lat' | 'lng' | 't' | 'accuracy' | 'mocked' | 'speedMs'> & {
  segment?: number;
};

export const SPEED_WINDOW_MS = 10_000;
const MAX_SPEED_ACCURACY_M = 25;
// A fix can arrive just after the display clock last ticked.
const DISPLAY_TICK_MS = 1000;

function usableFix(fix: SpeedFix) {
  return !fix.mocked && fix.accuracy >= 0 && fix.accuracy <= MAX_SPEED_ACCURACY_M;
}

export function currentSpeed(
  fixes: readonly SpeedFix[],
  now: number,
  segment?: number,
): number | null {
  const latest = fixes.at(-1);
  if (
    !latest ||
    !usableFix(latest) ||
    latest.segment !== segment ||
    latest.t - now > DISPLAY_TICK_MS ||
    now - latest.t >= SPEED_WINDOW_MS
  ) {
    return null;
  }

  const nativeSpeed = latest.speedMs;
  if (nativeSpeed !== null && nativeSpeed !== undefined && nativeSpeed >= 0) {
    if (nativeSpeed > JUMP_SPEED_MS) return null;
    return nativeSpeed < 0.3 ? 0 : nativeSpeed * 3.6;
  }

  // A pair of nearby fixes often measures location noise. Estimate over a longer baseline.
  for (let i = fixes.length - 2; i >= 0; i -= 1) {
    const earlier = fixes[i];
    const elapsed = latest.t - earlier.t;
    if (elapsed > SPEED_WINDOW_MS || earlier.segment !== segment) break;
    if (elapsed < 4_000 || !usableFix(earlier)) continue;
    const distance = haversineM(earlier.lat, earlier.lng, latest.lat, latest.lng);
    if (distance <= Math.hypot(earlier.accuracy, latest.accuracy)) continue;
    const speed = (distance * 1000) / elapsed;
    if (speed <= JUMP_SPEED_MS) return speed * 3.6;
  }

  return null;
}
