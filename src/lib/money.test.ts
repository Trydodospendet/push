import { formatAmount } from './money';

describe('formatAmount', () => {
  it.each([
    [0, '0,00'],
    [1, '0,01'],
    [100, '1,00'],
    [133_3, '13,33'],
    [10_000, '100,00'],
    [123_456_789, '1.234.567,89'],
    [-500, '-5,00'],
  ])('formats %p cents as %p', (cents, expected) => {
    expect(formatAmount(cents)).toBe(expected);
  });

  it('rejects amounts that are not whole cents', () => {
    expect(() => formatAmount(1.5)).toThrow(RangeError);
    expect(() => formatAmount(Number.NaN)).toThrow(RangeError);
  });
});
