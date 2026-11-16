import { render, screen, userEvent } from '@testing-library/react-native';

import { HoldButton } from './hold-button';

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

async function renderButton(onComplete: () => void) {
  await render(
    <HoldButton
      label="5 Pfand setzen"
      holdingLabel="Weiter halten …"
      accessibilityHint="Gedrückt halten"
      onComplete={onComplete}
    />,
  );
  return screen.getByRole('button', { name: '5 Pfand setzen' });
}

describe('HoldButton', () => {
  it('does nothing when it is released too early', async () => {
    const onComplete = jest.fn();
    const user = userEvent.setup();
    await user.longPress(await renderButton(onComplete), { duration: 300 });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('fires exactly once when it was held long enough', async () => {
    const onComplete = jest.fn();
    const user = userEvent.setup();
    await user.longPress(await renderButton(onComplete), { duration: 1200 });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
