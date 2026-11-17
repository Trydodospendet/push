import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, layout, motion } from '@/theme';

import { clampProgress } from './progress-bar';

export type ProgressRingProps = {
  /** Share of the goal that is reached, from 0 to 1. Values outside are clamped. */
  progress: number;
  /** Describes what the ring measures. */
  accessibilityLabel: string;
  /** Content in the middle of the ring, e.g. the big number. */
  children?: ReactNode;
  testID?: string;
  /** Rotation of the ring in degrees (native-driven, for the fidget ring). */
  spin?: Animated.Value;
};

const GLOW_PAD = 10;
const { size, holeShare, stroke } = layout.ring;
const middle = size / 2;
const GLOW_LAYERS = [
  { extra: 18, opacity: 0.08 },
  { extra: 9, opacity: 0.16 },
] as const;
const radius = (size - stroke) / 2 - GLOW_PAD;
const circumference = 2 * Math.PI * radius;

/** Length of the lit arc and of the gap behind it, for a stroke dash array. */
export function arcDash(progress: number): [number, number] {
  const length = clampProgress(progress) * circumference;
  return [length, circumference - length];
}

/**
 * Slim lime ring: a dark track and the lit arc on top, with a soft glow made of two wider,
 * transparent strokes underneath. The arc starts at twelve o'clock and runs clockwise.
 */
export function ProgressRing({
  progress,
  accessibilityLabel,
  children,
  testID,
  spin,
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

  const [lit, gap] = arcDash(shown);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      testID={testID}
      style={styles.root}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          spin && {
            transform: [
              {
                rotate: spin.interpolate({
                  inputRange: [-1440, 1440],
                  outputRange: ['-1440deg', '1440deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={middle}
            cy={middle}
            r={radius}
            stroke={colors.surfaceRaised}
            strokeWidth={stroke}
            fill="none"
          />
          {shown > 0 ? (
            <>
              {GLOW_LAYERS.map((layer) => (
                <Circle
                  key={layer.extra}
                  cx={middle}
                  cy={middle}
                  r={radius}
                  stroke={colors.accent}
                  strokeOpacity={layer.opacity}
                  strokeWidth={stroke + layer.extra}
                  strokeLinecap="round"
                  strokeDasharray={`${lit} ${gap}`}
                  rotation={-90}
                  origin={`${middle}, ${middle}`}
                  fill="none"
                />
              ))}
              <Circle
                cx={middle}
                cy={middle}
                r={radius}
                stroke={colors.accent}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${lit} ${gap}`}
                rotation={-90}
                origin={`${middle}, ${middle}`}
                fill="none"
              />
            </>
          ) : null}
        </Svg>
      </Animated.View>
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
  center: {
    width: size * holeShare,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
