import { wedgePath } from './progress-ring';

describe('wedgePath', () => {
  it('stays closed and ends at the top without progress', () => {
    expect(wedgePath(0)).toContain('0 1 140 -140');
    expect(wedgePath(Number.NaN)).toBe(wedgePath(0));
  });

  it('uses the large arc beyond half of the goal', () => {
    expect(wedgePath(0.25)).toContain(' 0 0 1 ');
    expect(wedgePath(0.75)).toContain(' 0 1 1 ');
  });

  it('clamps values outside of the range', () => {
    expect(wedgePath(2)).toBe(wedgePath(1));
  });
});
