import { useEffect, type ReactNode } from 'react';
import { Animated, Easing, useAnimatedValue, type StyleProp, type ViewStyle } from 'react-native';

import { useMotionEnabled } from '@/features/preferences/motion';

export type FadeInProps = {
  children: ReactNode;
  /** Wait this long before starting (for staggered lists). */
  delayMs?: number;
  /** Start this far below the final position (points). */
  rise?: number;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Fades in and rises a little. Without animations (own switch or system "reduce motion") the
 * content is simply there.
 */
export function FadeIn({ children, delayMs = 0, rise = 16, durationMs = 450, style }: FadeInProps) {
  const motionOn = useMotionEnabled();
  const progress = useAnimatedValue(motionOn ? 0 : 1);

  useEffect(() => {
    if (!motionOn) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      delay: delayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delayMs, durationMs, motionOn, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
