import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

/** Text grows with the system font size, up to 1.5 times, so layouts do not break. */
const MAX_FONT_SCALE = 1.5;

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[
        variantStyles[variant],
        { color: colors[color] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}

const variantStyles = StyleSheet.create(typography);
