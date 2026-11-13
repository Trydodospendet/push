import { Image, StyleSheet, View } from 'react-native';

import { initials } from '@/lib/initials';
import { colors, layout, radius } from '@/theme';

import { Text } from './text';

export type AvatarProps = {
  name: string;
  size?: keyof typeof layout.avatar;
  /** Lime fill for the signed-in user. */
  highlight?: boolean;
  /** Own picture (a temporary link); other people always show initials. */
  uri?: string | null;
};

const textVariant = { sm: 'caption', md: 'body', lg: 'title' } as const;

/** Initials in a circle. Decorative: the name is always shown next to it. */
export function Avatar({ name, size = 'md', highlight = false, uri = null }: AvatarProps) {
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
      {uri ? (
        <Image source={{ uri }} style={{ width: dimension, height: dimension }} />
      ) : (
        <Text variant={textVariant[size]} color={highlight ? 'onAccent' : 'text'}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  highlight: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
