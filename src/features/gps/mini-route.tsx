import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * The shape of a run as a small drawing (the points come normalized into a 0–1000 box and
 * carry no coordinates). Decorative: the row of the history says everything in words.
 */
export function MiniRoute({
  points,
  size = 56,
}: {
  points: readonly (readonly [number, number])[];
  size?: number;
}) {
  if (points.length < 2) {
    return null;
  }
  const d = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  return (
    <Svg
      width={size}
      height={size}
      viewBox="-60 -60 1120 1120"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={d}
        stroke={colors.accent}
        strokeWidth={70}
        strokeOpacity={0.25}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={d}
        stroke={colors.accent}
        strokeWidth={36}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
