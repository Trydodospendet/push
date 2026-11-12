import { filledSegments } from './progress-ring';

describe('filledSegments', () => {
  it('is empty without progress and full at the goal', () => {
    expect(filledSegments(0)).toBe(0);
    expect(filledSegments(1)).toBe(60);
    expect(filledSegments(2)).toBe(60);
  });

  it('lights at least one bar for a tiny progress', () => {
    expect(filledSegments(0.001)).toBe(1);
  });

  it('fills proportionally', () => {
    expect(filledSegments(0.5)).toBe(30);
    expect(filledSegments(Number.NaN)).toBe(0);
  });
});
