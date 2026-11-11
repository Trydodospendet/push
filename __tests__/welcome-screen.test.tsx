import { render, screen } from '@testing-library/react-native';

import WelcomeScreen from '../app/(auth)/welcome';

describe('WelcomeScreen', () => {
  it('shows the logo, the claim and the start button', async () => {
    await render(<WelcomeScreen />);

    expect(screen.getByRole('header', { name: 'PUSH' })).toHaveTextContent('PUSH.');
    expect(screen.getByText('YOUR GOALS. YOUR STAKES.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Loslegen' })).toBeEnabled();
  });
});
