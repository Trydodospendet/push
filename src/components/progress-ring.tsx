import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';

import { furImages } from '@/features/fur/images';
import { layout, motion } from '@/theme';

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

const { size, holeShare } = layout.ring;
const middle = size / 2;

/** Pie slice from twelve o'clock clockwise; used as the mask that reveals the filled ring. */
export function wedgePath(progress: number): string {
  const angle = clampProgress(progress) * 2 * Math.PI;
  const reach = size;
  const endX = middle + reach * Math.sin(angle);
  const endY = middle - reach * Math.cos(angle);
  const large = angle > Math.PI ? 1 : 0;
  return `M ${middle} ${middle} L ${middle} ${middle - reach} A ${reach} ${reach} 0 ${large} 1 ${endX} ${endY} Z`;
}

/**
 * Fur ring: a dimmed ring underneath and the full-colour ring on top, revealed by a circular
 * mask up to the progress.
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

  const full = shown >= 0.999;

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
          <Defs>
            <ClipPath id="ringFill">
              <Path d={wedgePath(shown)} />
            </ClipPath>
          </Defs>
          <SvgImage href={furImages.ring} width={size} height={size} opacity={0.22} />
          {shown > 0 ? (
            <SvgImage
              href={furImages.ring}
              width={size}
              height={size}
              clipPath={full ? undefined : 'url(#ringFill)'}
            />
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
