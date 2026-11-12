import { barHeight } from './week-chart';

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

describe('barHeight', () => {
  it('shows a small stub for days without a run', () => {
    expect(barHeight(0, 5000)).toBe(4);
    expect(barHeight(0, 0)).toBe(4);
  });

  it('scales the longest day to the full chart height', () => {
    expect(barHeight(5000, 5000)).toBe(96);
    expect(barHeight(2500, 5000)).toBe(48);
  });
});
