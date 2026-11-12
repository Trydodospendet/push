import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';

import { colors, layout, motion, radius } from '@/theme';

import { clampProgress } from './progress-bar';

export type ProgressRingProps = {
  /** Share of the goal that is reached, from 0 to 1. Values outside are clamped. */
  progress: number;
  /** Describes what the ring measures. */
  accessibilityLabel: string;
  /** Content in the middle of the ring, e.g. the big number. */
  children?: ReactNode;
  testID?: string;
};

const { size, segments, segmentWidth, segmentLength } = layout.ring;
const radiusToSegmentCenter = size / 2 - segmentLength / 2;

/** How many bars are lime for a share of the goal; a tiny non-zero share lights one bar. */
export function filledSegments(progress: number): number {
  const clamped = clampProgress(progress);
  return clamped > 0 ? Math.max(1, Math.round(clamped * segments)) : 0;
}

/**
 * Ring made of short bars, lime up to the progress and grey beyond. Built from plain views
 * because no SVG library is installed.
 */
export function ProgressRing({
  progress,
  accessibilityLabel,
  children,
  testID,
}: ProgressRingProps) {
  const clamped = clampProgress(progress);
  const animated = useAnimatedValue(clamped);
  const [shown, setShown] = useState(clamped);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setShown(value));
    const animation = Animated.timing(animated, {
      toValue: clamped,
      duration: motion.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      animated.removeListener(id);
    };
  }, [animated, clamped]);

  const filled = filledSegments(shown);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      testID={testID}
      style={styles.root}
    >
      {Array.from({ length: segments }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            index < filled && styles.segmentFilled,
            {
              transform: [
                { rotate: `${(index / segments) * 360}deg` },
                { translateY: -radiusToSegmentCenter },
              ],
            },
          ]}
        />
      ))}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: size,
    height: size,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    position: 'absolute',
    left: (size - segmentWidth) / 2,
    top: (size - segmentLength) / 2,
    width: segmentWidth,
    height: segmentLength,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  segmentFilled: {
    backgroundColor: colors.accent,
  },
  center: {
    width: size - 2 * (segmentLength + 12),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
