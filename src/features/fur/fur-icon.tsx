import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

import { furImages } from './images';

type FurIconName = 'flame' | 'trophy' | 'heart' | 'home' | 'shoe' | 'arrow';

const aspect: Record<FurIconName, number> = {
  flame: 145 / 192,
  trophy: 113 / 128,
  heart: 143 / 128,
  home: 103 / 96,
  shoe: 172 / 96,
  arrow: 95 / 128,
};

/** A small fur picture; `dim` darkens it for inactive states. Decorative unless labelled. */
export function FurIcon({
  name,
  size,
  dim = false,
  label,
  style,
}: {
  name: FurIconName;
  /** Height in points. */
  size: number;
  dim?: boolean;
  label?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={furImages[name]}
      resizeMode="contain"
      fadeDuration={0}
      accessible={label !== undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={label === undefined}
      importantForAccessibility={label === undefined ? 'no' : 'yes'}
      style={[{ width: size * aspect[name], height: size }, dim && styles.dim, style]}
    />
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.4 },
});
