import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  return (
    <RNText
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
