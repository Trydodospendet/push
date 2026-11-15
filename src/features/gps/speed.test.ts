import { formatSpeed } from './format';
import { currentSpeed } from './speed';

const fix = { lat: 0, lng: 0, t: 1000, accuracy: 5, mocked: false, segment: 0 };

test('converts native m/s and distinguishes a stop from missing data', () => {
  expect(formatSpeed(currentSpeed([{ ...fix, speedMs: 2.5 }], 1000, 0))).toBe('9');
  expect(formatSpeed(currentSpeed([{ ...fix, speedMs: 2.125 }], 1000, 0))).toBe('7,7');
  expect(currentSpeed([{ ...fix, speedMs: 0 }], 1000, 0)).toBe(0);
  expect(formatSpeed(currentSpeed([fix], 1000, 0))).toBe('—');
});

test('estimates speed across reliable fixes and ignores jitter', () => {
  expect(currentSpeed([fix, { ...fix, t: 6000, lng: 0.00015 }], 6000, 0)).toBeCloseTo(12.0, 1);
  expect(currentSpeed([fix, { ...fix, t: 6000, lng: 0.00002 }], 6000, 0)).toBeNull();
  expect(currentSpeed([fix, { ...fix, t: 6000, lng: 0.00015, segment: 1 }], 6000, 1)).toBeNull();
});

test('rejects stale, inaccurate and implausible measurements', () => {
  const moving = { ...fix, speedMs: 3 };
  expect(currentSpeed([moving], 11000, 0)).toBeNull();
  expect(currentSpeed([moving], 500, 0)).toBeCloseTo(10.8);
  expect(currentSpeed([moving], 1000, 1)).toBeNull();
  expect(currentSpeed([{ ...moving, accuracy: 60 }], 1000, 0)).toBeNull();
  expect(currentSpeed([{ ...moving, mocked: true }], 1000, 0)).toBeNull();
  expect(currentSpeed([{ ...moving, speedMs: 15 }], 1000, 0)).toBeNull();
});
