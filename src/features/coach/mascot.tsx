import Svg, { Ellipse, Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';
/** A lime running hare, drawn locally at every size. */
export function Mascot({ stage, dizzy, gaze }: { stage: number; dizzy: boolean; gaze: number }) {
  return (
    <Svg width={64} height={76} viewBox="0 0 80 96">
      {stage === 0 ? (
        <>
          <Ellipse cx="40" cy="52" rx="27" ry="36" fill={colors.accent} />
          <Path
            d="M18 48 L30 40 L40 52 L50 42 L62 50"
            fill="none"
            stroke={colors.bg}
            strokeWidth="3"
          />
        </>
      ) : (
        <>
          <Ellipse cx="28" cy="24" rx="9" ry={stage > 1 ? 23 : 17} fill={colors.accent} />
          <Ellipse cx="52" cy="24" rx="9" ry={stage > 1 ? 23 : 17} fill={colors.accent} />
          <Ellipse cx="40" cy="60" rx={24 + stage} ry="28" fill={colors.accent} />
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
  );
}
