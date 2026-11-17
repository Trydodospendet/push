import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, useAnimatedValue, View } from 'react-native';

import { furImages, type PushyPose } from '@/features/fur/images';
import { useMotionEnabled } from '@/features/preferences/motion';

export const PUSHY_WIDTH = 84;
export const PUSHY_HEIGHT = 96;
const FADE_MS = 220;

/** Pushy as a fur picture. A change of pose fades softly from the old picture to the new one. */
export function Pushy({ pose, scale = 1 }: { pose: PushyPose; scale?: number }) {
  const motion = useMotionEnabled();
  const fade = useAnimatedValue(1);
  const [layers, setLayers] = useState({ from: pose, to: pose });
  if (layers.to !== pose) {
    setLayers({ from: layers.to, to: pose });
  }

  useEffect(() => {
    if (layers.from === layers.to) return;
    if (!motion) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
  }, [layers, motion, fade]);

  const size = { width: PUSHY_WIDTH * scale, height: PUSHY_HEIGHT * scale };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, size]}
    >
      <Animated.Image
        source={furImages.pushy[layers.from]}
        resizeMode="contain"
        fadeDuration={0}
        style={[
          styles.layer,
          { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        ]}
      />
      <Image
        source={furImages.pushy[layers.to]}
        resizeMode="contain"
        fadeDuration={0}
        style={styles.layer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'flex-end' },
  layer: { position: 'absolute', width: '100%', height: '100%' },
});
