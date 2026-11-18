import { liveSpeedKmh, type TrackPoint } from './geo';

function fix(t: number, lat: number, accuracy = 5): TrackPoint {
  return { lat, lng: 10, t, accuracy, segment: 0, mocked: false, altitude: null };
}

describe('liveSpeedKmh', () => {
  it('averages over the last ten seconds', () => {
    // ~3 m per second = ~10.8 km/h
    const points = [0, 1, 2, 3, 4, 5].map((s) => fix(s * 1000, 50 + s * 0.000027));
    const speed = liveSpeedKmh(points, 5000);
    expect(speed).not.toBeNull();
    expect(speed).toBeGreaterThan(10);
    expect(speed).toBeLessThan(12);
  });

  it('shows 0 below 1 km/h', () => {
    const points = [fix(0, 50), fix(5000, 50.000001)];
    expect(liveSpeedKmh(points, 5000)).toBe(0);
  });

  it('is unknown with a weak or stale signal', () => {
    expect(liveSpeedKmh([fix(0, 50, 80), fix(4000, 50.0001, 80)], 4000)).toBeNull();
    expect(liveSpeedKmh([fix(0, 50), fix(4000, 50.0001)], 20000)).toBeNull();
    expect(liveSpeedKmh([fix(0, 50)], 0)).toBeNull();
  });
});
