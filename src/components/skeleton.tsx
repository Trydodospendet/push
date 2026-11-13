import { useEffect } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useAnimatedValue,
  View,
  type DimensionValue,
} from 'react-native';

import { useMotionEnabled } from '@/features/preferences/motion';
import { colors, radius, spacing } from '@/theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  /** Fully rounded (avatars). */
  round?: boolean;
};

/** A grey placeholder that softly pulses while content loads; still when animations are off. */
export function Skeleton({ width = '100%', height = spacing.lg, round = false }: SkeletonProps) {
  const motionOn = useMotionEnabled();
  const pulse = useAnimatedValue(0);

  useEffect(() => {
    if (!motionOn) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOn, pulse]);

  return (
    <Animated.View
      style={[
        styles.bar,
        { width, height, borderRadius: round ? radius.pill : radius.card / 2 },
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
      ]}
    />
  );
}

/** A card-shaped group of skeleton lines, the usual stand-in for a list row or a panel. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={spacing.md} />
      {Array.from({ length: lines - 1 }, (_, index) => (
        <Skeleton key={index} width={index % 2 === 0 ? '100%' : '70%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surfaceRaised,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
