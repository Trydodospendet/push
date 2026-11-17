import { render, screen } from '@testing-library/react-native';

import { FurNumber } from './fur-number';

describe('FurNumber', () => {
  it('speaks the real value with its unit', async () => {
    await render(<FurNumber value="3,25" unit="km" />);
    expect(screen.getByLabelText('3,25 Kilometer')).toBeOnTheScreen();
  });

  it('falls back to text for values the images cannot draw', async () => {
    await render(<FurNumber value="–:––" />);
    expect(screen.getByText('–:––')).toBeOnTheScreen();
  });
});
