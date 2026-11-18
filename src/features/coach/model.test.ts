import { countReversals, isNight, snapX } from './model';

describe('isNight', () => {
  it('is night from 22 to 6', () => {
    expect(isNight(22)).toBe(true);
    expect(isNight(3)).toBe(true);
    expect(isNight(6)).toBe(false);
    expect(isNight(21)).toBe(false);
  });
});

describe('countReversals', () => {
  it('counts direction changes of a wiggle', () => {
    expect(countReversals([0, 40, 0, 40, 0], 20)).toBe(3);
  });

  it('ignores a straight drag and tiny jitter', () => {
    expect(countReversals([0, 30, 60, 90], 20)).toBe(0);
    expect(countReversals([0, 3, -2, 4, -3], 20)).toBe(0);
  });
});

describe('snapX', () => {
  it('snaps to the nearer side edge', () => {
    expect(snapX(50, 400, 60, 4)).toBe(4);
    expect(snapX(300, 400, 60, 4)).toBe(336);
  });
});
