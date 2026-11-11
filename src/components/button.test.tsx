import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it('shows its label and reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Loslegen" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Loslegen' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Loslegen" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Loslegen' });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is busy and ignores presses while loading', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Loslegen" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Loslegen, Wird geladen' });
    await user.press(button);

    expect(button).toBeBusy();
    expect(screen.queryByText('Loslegen')).not.toBeOnTheScreen();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('prefers an explicit accessibility label over the visible label', async () => {
    await render(
      <Button label="OK" accessibilityLabel="Challenge beitreten" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Challenge beitreten' })).toBeOnTheScreen();
  });
});
