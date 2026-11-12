import { StyleSheet, View } from 'react-native';

import { initials } from '@/lib/initials';
import { colors, layout, radius } from '@/theme';

import { Text } from './text';

export type AvatarProps = {
  name: string;
  size?: keyof typeof layout.avatar;
  /** Lime fill for the signed-in user. */
  highlight?: boolean;
};

const textVariant = { sm: 'caption', md: 'body', lg: 'title' } as const;

/** Initials in a circle. Decorative: the name is always shown next to it. */
export function Avatar({ name, size = 'md', highlight = false }: AvatarProps) {
  const dimension = layout.avatar[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: dimension, height: dimension },
        highlight && styles.highlight,
      ]}
    >
      <Text variant={textVariant[size]} color={highlight ? 'onAccent' : 'text'}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  highlight: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
