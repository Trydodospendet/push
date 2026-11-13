import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

export type GlowBackdropProps = {
  /** Diameter of the glow in points. */
  size?: number;
  /** Peak opacity of the lime in the middle (0 to 1). */
  intensity?: number;
};

/**
 * A soft lime glow at the top edge of a screen, behind the content. Decorative only: it is
 * hidden from screen readers and ignores touches.
 */
export function GlowBackdrop({ size = 420, intensity = 0.22 }: GlowBackdropProps) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, { width: size, height: size, marginLeft: -size / 2, top: -size / 2.2 }]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={intensity} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: '50%',
  },
});
