import { Image, StyleSheet, View } from 'react-native';

import { allFurSources } from './images';

/** Mounts every fur image once, invisibly and outside the screen (no stray dot), so they are decoded before a screen needs them. */
export function FurPreload() {
  return (
    <View pointerEvents="none" style={styles.hidden} accessibilityElementsHidden>
      {allFurSources.map((source, index) => (
        <Image key={index} source={source} style={styles.image} fadeDuration={0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -10,
    top: -10,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  image: { width: 1, height: 1 },
});
