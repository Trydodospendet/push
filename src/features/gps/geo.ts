/**
 * Distance and time of a GPS track, for the live display only. The server measures again
 * from the uploaded points with the same rules (public.sync_gps_run) and decides.
 * Constants must match supabase/migrations/20261121090000_gps_runs.sql.
 */

/** Points with a worse accuracy (metres) are ignored. */
export const MAX_ACCURACY_M = 50;
/** A step faster than this (m/s) is a jump, not a run. */
export const JUMP_SPEED_MS = 12;
/** After this many jumps in a row the track is taken to continue at the new place. */
export const JUMP_RESET_STREAK = 5;
/** Three jumps or more make the server reject the run. */
export const MAX_JUMPS = 3;

const EARTH_RADIUS_M = 6_371_000;

export type TrackPoint = {
  lat: number;
  lng: number;
  /** Epoch milliseconds. */
  t: number;
  /** Horizontal accuracy in metres. */
  accuracy: number;
  /** Starts at 0 and grows after every pause; nothing is measured between segments. */
  segment: number;
  /** The phone flagged the position as mocked (fake GPS). */
  mocked: boolean;
};

export type Measurement = {
  distanceM: number;
  /** Seconds between the counted points. */
  movingS: number;
  /** Points that were used for the measurement. */
  usedPoints: number;
  jumps: number;
  mockedPoints: number;
};

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Same walk through the points as the server: accuracy filter, segments, jumps. */
export function measureTrack(points: readonly TrackPoint[]): Measurement {
  let distanceM = 0;
  let movingS = 0;
  let usedPoints = 0;
  let jumps = 0;
  let jumpStreak = 0;
  let mockedPoints = 0;
  let prev: TrackPoint | null = null;

  for (const point of points) {
    if (point.accuracy > MAX_ACCURACY_M) {
      continue;
    }
    if (point.mocked) {
      mockedPoints += 1;
    }
    if (prev === null || point.segment !== prev.segment) {
      prev = point;
      usedPoints += 1;
      continue;
    }
    const seconds = (point.t - prev.t) / 1000;
    if (seconds <= 0) {
      continue;
    }
    const step = haversineM(prev.lat, prev.lng, point.lat, point.lng);
    if (step / seconds > JUMP_SPEED_MS) {
      jumps += 1;
      jumpStreak += 1;
      if (jumpStreak >= JUMP_RESET_STREAK) {
        prev = point;
        jumpStreak = 0;
      }
      continue;
    }
    jumpStreak = 0;
    distanceM += step;
    movingS += seconds;
    usedPoints += 1;
    prev = point;
  }

  return { distanceM, movingS, usedPoints, jumps, mockedPoints };
}

/** Seconds per kilometre, or null while there is nothing to divide by. */
export function paceSecondsPerKm(distanceM: number, seconds: number): number | null {
  if (distanceM < 10 || seconds <= 0) {
    return null;
  }
  return (seconds / distanceM) * 1000;
}
