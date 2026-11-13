import { userEvent, render, screen } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { ShareButton } from './share-button';
import { SHARE_HEIGHT, SHARE_WIDTH } from './share-card';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

const data = {
  label: 'MEIN LAUF',
  headline: '5,20 km',
  facts: [{ label: 'ZEIT', value: '28:10' }],
  shape: [
    [0, 0],
    [500, 400],
    [1000, 1000],
  ] as [number, number][],
};

describe('ShareButton', () => {
  beforeEach(() => {
    jest.mocked(captureRef).mockClear();
    jest.mocked(Sharing.shareAsync).mockClear();
  });

  it('captures the card as a story image and opens the share menu', async () => {
    const user = userEvent.setup();
    await render(<ShareButton data={data} />);

    await user.press(screen.getByRole('button', { name: 'Teilen' }));

    expect(captureRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: 'png', width: SHARE_WIDTH, height: SHARE_HEIGHT }),
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///tmp/share.png',
      expect.objectContaining({ mimeType: 'image/png' }),
    );
  });

  it('says so when the image cannot be shared', async () => {
    const user = userEvent.setup();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    await render(<ShareButton data={data} />);

    await user.press(screen.getByRole('button', { name: 'Teilen' }));

    expect(await screen.findByText(/Das Bild konnte nicht erstellt werden/)).toBeOnTheScreen();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
