import { render, screen } from '@testing-library/react-native';

import { clampProgress, ProgressBar } from './progress-bar';

describe('clampProgress', () => {
  it.each([
    [0, 0],
    [0.65, 0.65],
    [1, 1],
    [-0.2, 0],
    [1.7, 1],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('maps %p to %p', (input, expected) => {
    expect(clampProgress(input)).toBe(expected);
  });
});

describe('ProgressBar', () => {
  it('exposes the progress as a percentage to assistive technology', async () => {
    await render(<ProgressBar progress={0.65} accessibilityLabel="Fortschritt" />);

    expect(screen.getByRole('progressbar', { name: 'Fortschritt' })).toHaveAccessibilityValue({
      min: 0,
      max: 100,
      now: 65,
    });
  });

  it('never reports more than 100 percent', async () => {
    await render(<ProgressBar progress={3} accessibilityLabel="Fortschritt" />);

    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 100 });
  });
});
