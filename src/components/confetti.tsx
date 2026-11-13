import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';

import { useMotionEnabled } from '@/features/preferences/motion';
import { colors, radius } from '@/theme';

export type ConfettiProps = {
  /** Number of pieces. */
  count?: number;
  /** How far the pieces fly (points). */
  distance?: number;
  durationMs?: number;
};

const PALETTE = [colors.accent, colors.accent, colors.text, colors.textSecondary] as const;

/** Small deterministic pseudo-random number from an index (same picture on every render). */
function noise(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Lime and white confetti that bursts out of the middle, falls a little and fades. Plays once
 * when mounted and shows nothing when animations are off (own switch or "reduce motion").
 */
export function Confetti({ count = 28, distance = 190, durationMs = 1600 }: ConfettiProps) {
  const motionOn = useMotionEnabled();
  const progress = useAnimatedValue(0);

  useEffect(() => {
    if (!motionOn) {
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [durationMs, motionOn, progress]);

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const angle = noise(index, 1) * Math.PI * 2;
        const reach = distance * (0.45 + noise(index, 2) * 0.55);
        return {
          x: Math.cos(angle) * reach,
          y: Math.sin(angle) * reach,
          fall: 40 + noise(index, 3) * 60,
          spin: (noise(index, 4) > 0.5 ? 1 : -1) * (180 + noise(index, 5) * 360),
          width: 6 + noise(index, 6) * 6,
          height: 8 + noise(index, 7) * 10,
          color: PALETTE[index % PALETTE.length],
        };
      }),
    [count, distance],
  );

  if (!motionOn) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.root}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.piece,
            {
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.1, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.x],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 0.6, 1],
                    outputRange: [0, piece.y, piece.y + piece.fall],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${piece.spin}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piece: {
    position: 'absolute',
    borderRadius: radius.pill / 100,
  },
});
