import type { TrackPoint } from './geo';

/**
 * Compact text form of a track for the on-phone checkpoint (SecureStore holds small chunks
 * only). One point is "dLat,dLng,dT,accuracy,segment,mocked;" with the first three as deltas
 * to the previous point: latitude/longitude in 1e-6 degrees, time in milliseconds.
 */
const SCALE = 1e6;

export function encodeTrack(points: readonly TrackPoint[]): string {
  let lat = 0;
  let lng = 0;
  let t = 0;
  let out = '';
  for (const point of points) {
    const nextLat = Math.round(point.lat * SCALE);
    const nextLng = Math.round(point.lng * SCALE);
    out +=
      [
        nextLat - lat,
        nextLng - lng,
        point.t - t,
        Math.round(point.accuracy),
        point.segment,
        point.mocked ? 1 : 0,
      ].join(',') + ';';
    lat = nextLat;
    lng = nextLng;
    t = point.t;
  }
  return out;
}

/** Returns an empty track for damaged input instead of throwing. */
export function decodeTrack(text: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  let lat = 0;
  let lng = 0;
  let t = 0;
  for (const entry of text.split(';')) {
    if (entry === '') {
      continue;
    }
    const parts = entry.split(',').map(Number);
    if (parts.length !== 6 || parts.some((part) => !Number.isFinite(part))) {
      return [];
    }
    const [dLat, dLng, dT, accuracy, segment, mocked] = parts;
    lat += dLat;
    lng += dLng;
    t += dT;
    points.push({ lat: lat / SCALE, lng: lng / SCALE, t, accuracy, segment, mocked: mocked === 1 });
  }
  return points;
}
