import { useEffect, type ReactNode } from 'react';
import {
  Animated,
  StyleSheet,
  useAnimatedValue,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useMotionEnabled } from '@/features/preferences/motion';
import { colors } from '@/theme';

export type GlowPulseProps = {
  children: ReactNode;
  /** Corner radius of the lit shape behind the children. */
  radius: number;
  /** Blur of the halo in points. */
  blur?: number;
  /** Peak opacity of the halo (0 to 1). */
  intensity?: number;
  /** Lights the halo only while true (e.g. the active tab). */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PULSE_MS = 1800;

/**
 * A lime halo behind its children that slowly breathes. With reduced motion (system or app
 * setting) it stays still. Decorative: it ignores touches and is hidden from screen readers.
 */
export function GlowPulse({
  children,
  radius,
  blur = 22,
  intensity = 0.55,
  active = true,
  style,
}: GlowPulseProps) {
  const motionOn = useMotionEnabled();
  const level = useAnimatedValue(1);

  useEffect(() => {
    if (!motionOn || !active) {
      level.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(level, { toValue: 0.45, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(level, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOn, active, level]);

  return (
    <View style={style}>
      {active ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              opacity: Animated.multiply(level, intensity),
              boxShadow: [
                {
                  offsetX: 0,
                  offsetY: 0,
                  blurRadius: blur,
                  spreadDistance: 2,
                  color: colors.accent,
                },
              ],
            },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}
