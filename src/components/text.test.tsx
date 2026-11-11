import { render, screen } from '@testing-library/react-native';

import { colors, typography } from '@/theme';

import { Text } from './text';

describe('Text', () => {
  it('uses the body style in the primary text color by default', async () => {
    await render(<Text>Hallo</Text>);

    expect(screen.getByText('Hallo')).toHaveStyle({ ...typography.body, color: colors.text });
  });

  it('applies the requested variant, color and alignment', async () => {
    await render(
      <Text variant="label" color="textSecondary" align="center">
        Heute
      </Text>,
    );

    expect(screen.getByText('Heute')).toHaveStyle({
      ...typography.label,
      color: colors.textSecondary,
      textAlign: 'center',
    });
  });
});
