import { arcDash } from './progress-ring';

describe('arcDash', () => {
  it('lights nothing without progress', () => {
    expect(arcDash(0)[0]).toBe(0);
    expect(arcDash(Number.NaN)[0]).toBe(0);
  });

  it('splits the circumference between arc and gap', () => {
    const [lit, gap] = arcDash(0.25);
    const [full] = arcDash(1);
    expect(lit).toBeCloseTo(full / 4);
    expect(lit + gap).toBeCloseTo(full);
  });

  it('clamps values outside of the range', () => {
    expect(arcDash(2)).toEqual(arcDash(1));
  });
});
