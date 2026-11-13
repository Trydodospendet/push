import { renderHook } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import type { TrackPoint } from './geo';
import { announcementFor, useKilometerAnnouncements } from './voice';

/** A straight run north at 3 m/s: 1 km every ~333 s (0.00009 degrees ≈ 10 m). */
function run(km: number): TrackPoint[] {
  const points: TrackPoint[] = [];
  const steps = km * 100;
  for (let i = 0; i <= steps; i += 1) {
    points.push({
      lat: 50 + i * 0.00009,
      lng: 8,
      t: i * 3333,
      accuracy: 5,
      segment: 0,
      mocked: false,
      altitude: null,
    });
  }
  return points;
}

describe('announcementFor', () => {
  it('speaks kilometre, total time and the time of the kilometre', () => {
    expect(announcementFor(3, 335, 1005)).toBe(
      'Kilometer 3. Gesamtzeit 16 Minuten 45 Sekunden. Dieser Kilometer: 5 Minuten 35 Sekunden.',
    );
  });

  it('handles one hour and singular forms', () => {
    expect(announcementFor(10, 61, 3600)).toContain('eine Stunde');
    expect(announcementFor(1, 60, 60)).toContain('eine Minute');
  });
});

describe('useKilometerAnnouncements', () => {
  beforeEach(() => jest.mocked(Speech.speak).mockClear());

  it('speaks each new kilometre once and stays quiet when switched off', async () => {
    const { rerender } = await renderHook(
      ({ km, on }: { km: number; on: boolean }) => useKilometerAnnouncements(run(km), km * 333, on),
      { initialProps: { km: 0.5, on: true } },
    );
    expect(Speech.speak).not.toHaveBeenCalled();

    await rerender({ km: 1.2, on: true });
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Speech.speak).mock.calls[0][0]).toMatch(/^Kilometer 1\./);

    await rerender({ km: 1.5, on: true });
    expect(Speech.speak).toHaveBeenCalledTimes(1);

    await rerender({ km: 2.2, on: false });
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('does not repeat kilometres that were done before it was switched on', async () => {
    const { rerender } = await renderHook(
      ({ on }: { on: boolean }) => useKilometerAnnouncements(run(2.2), 700, on),
      { initialProps: { on: false } },
    );
    await rerender({ on: true });
    expect(Speech.speak).not.toHaveBeenCalled();
  });
});
