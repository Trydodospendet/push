import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Circle, Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '@/theme';
/** A lime running hare, drawn locally at every size. */
export function Mascot({ stage, dizzy, gaze }: { stage: number; dizzy: boolean; gaze: number }) {
  return (
    <View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.halo}
      >
        <Svg width={112} height={124}>
          <Defs>
            <RadialGradient id="coachHalo" cx="50%" cy="52%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.18} />
              <Stop offset="45%" stopColor={colors.accent} stopOpacity={0.09} />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={112} height={124} fill="url(#coachHalo)" />
        </Svg>
      </View>
      <Svg width={64} height={76} viewBox="0 0 80 96">
        {stage === 0 ? (
          <>
            <Ellipse cx="40" cy="52" rx="29" ry="38" fill={colors.surfaceRaised} />
            <Ellipse cx="40" cy="52" rx="27" ry="36" fill={colors.accent} />
            <Ellipse cx="40" cy="50" rx="21" ry="29" fill={colors.text} />
            <Path
              d="M18 52 L29 41 L40 53 L51 43 L62 51"
              fill="none"
              stroke={colors.bg}
              strokeWidth="3"
            />
            <Circle cx="30" cy="34" r="3" fill={colors.accent} />
            <Circle cx="51" cy="67" r="4" fill={colors.accent} />
          </>
        ) : (
          <>
            <Ellipse cx="28" cy="24" rx="9" ry={stage > 1 ? 23 : 17} fill={colors.text} />
            <Ellipse cx="52" cy="24" rx="9" ry={stage > 1 ? 23 : 17} fill={colors.text} />
            <Ellipse cx="40" cy="60" rx={24 + stage} ry="28" fill={colors.text} />
            <Ellipse cx="40" cy="60" rx={20 + stage} ry="24" fill={colors.accent} />
            <Ellipse cx="24" cy="87" rx="14" ry="5" fill={colors.accent} />
            <Ellipse cx="56" cy="87" rx="14" ry="5" fill={colors.accent} />
          </>
        )}
        {dizzy ? (
          <Path
            d="M23 49 l12 12 m0 -12 l-12 12 M45 49 l12 12 m0 -12 l-12 12"
            stroke={colors.bg}
            strokeWidth="3"
          />
        ) : (
          <>
            <Circle cx={29 + gaze} cy="54" r="4" fill={colors.bg} />
            <Circle cx={51 + gaze} cy="54" r="4" fill={colors.bg} />
          </>
        )}
        <Path d="M33 67 Q40 73 47 67" fill="none" stroke={colors.bg} strokeWidth="3" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', left: -24, top: -24 },
});
