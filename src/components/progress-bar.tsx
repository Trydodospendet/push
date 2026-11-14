import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';

import { colors, glow, layout, motion, radius } from '@/theme';

export type ProgressBarProps = {
  /** Share of the goal that is reached, from 0 to 1. Values outside are clamped. */
  progress: number;
  /** Describes what the bar measures, e.g. "Fortschritt der Challenge". */
  accessibilityLabel: string;
  testID?: string;
};

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.min(1, Math.max(0, progress));
}

export function ProgressBar({ progress, accessibilityLabel, testID }: ProgressBarProps) {
  const clamped = clampProgress(progress);
  const animated = useAnimatedValue(clamped);

  useEffect(() => {
    const animation = Animated.timing(animated, {
      toValue: clamped,
      duration: motion.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animated, clamped]);

  const width = animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      testID={testID}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: layout.progressBarHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 6, spreadDistance: 0, color: glow.soft }],
  },
});
