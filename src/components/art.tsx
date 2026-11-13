import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

export type ArtName =
  | 'target'
  | 'flag'
  | 'shield'
  | 'coins'
  | 'pool'
  | 'podium'
  | 'heart'
  | 'run'
  | 'steps'
  | 'trophy'
  | 'friends'
  | 'phone'
  | 'calendar'
  | 'share'
  | 'lock'
  | 'bolt'
  | 'map';

export type ArtProps = {
  name: ArtName;
  /** Width and height in points. */
  size?: number;
};

const STROKE = 3;
const common = {
  fill: 'none',
  strokeWidth: STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
const lime = { ...common, stroke: colors.accent } as const;
const white = { ...common, stroke: colors.text } as const;
const grey = { ...common, stroke: colors.textMuted } as const;

/** Little dots around the drawing; they make every picture look like part of one set. */
function Sparkles() {
  return (
    <G>
      <Circle cx="24" cy="30" r="3" fill={colors.accent} />
      <Circle cx="138" cy="22" r="2" fill={colors.textMuted} />
      <Circle cx="142" cy="120" r="3" fill={colors.accent} />
      <Circle cx="18" cy="116" r="2" fill={colors.textMuted} />
    </G>
  );
}

function Drawing({ name }: { name: ArtName }) {
  switch (name) {
    case 'target':
      return (
        <G>
          <Circle cx="80" cy="82" r="46" {...grey} />
          <Circle cx="80" cy="82" r="30" {...white} />
          <Circle cx="80" cy="82" r="14" {...lime} />
          <Circle cx="80" cy="82" r="3" fill={colors.accent} />
          <Line x1="80" y1="82" x2="122" y2="40" {...lime} />
          <Path d="M114 38 L124 38 L124 48" {...lime} />
        </G>
      );
    case 'flag':
      return (
        <G>
          <Line x1="52" y1="28" x2="52" y2="134" {...white} />
          <Path d="M52 32 L112 32 L100 52 L112 72 L52 72 Z" {...lime} fill={colors.surface} />
          <Path d="M36 134 L84 134" {...grey} />
          <Circle cx="52" cy="28" r="4" fill={colors.accent} />
        </G>
      );
    case 'shield':
      return (
        <G>
          <Path
            d="M80 24 L124 40 V80 C124 106 104 124 80 136 C56 124 36 106 36 80 V40 Z"
            {...white}
            fill={colors.surface}
          />
          <Path d="M58 80 L74 96 L104 62" {...lime} strokeWidth={5} />
        </G>
      );
    case 'coins':
      return (
        <G>
          <Path d="M40 112 C40 118 58 124 80 124 C102 124 120 118 120 112" {...grey} />
          <Path d="M40 96 C40 102 58 108 80 108 C102 108 120 102 120 96" {...grey} />
          <Path d="M40 80 C40 86 58 92 80 92 C102 92 120 86 120 80" {...white} />
          <Path d="M40 80 V112 M120 80 V112" {...grey} />
          <Path d="M40 80 C40 74 58 68 80 68 C102 68 120 74 120 80" {...white} />
          <Circle cx="80" cy="40" r="20" {...lime} fill={colors.surface} />
          <Path d="M80 31 V49 M74 36 H84 C88 36 88 44 84 44 H74" {...lime} />
        </G>
      );
    case 'pool':
      return (
        <G>
          <Path d="M38 74 H122 L112 132 H48 Z" {...white} fill={colors.surface} />
          <Path d="M32 74 H128" {...lime} />
          <Circle cx="64" cy="42" r="10" {...lime} />
          <Circle cx="96" cy="34" r="10" {...lime} />
          <Circle cx="80" cy="58" r="8" {...grey} />
          <Path d="M64 52 V62 M96 44 V56" {...grey} />
          <Path d="M64 104 H96" {...lime} />
        </G>
      );
    case 'podium':
      return (
        <G>
          <Rect x="28" y="88" width="32" height="46" rx="4" {...white} fill={colors.surface} />
          <Rect x="64" y="64" width="32" height="70" rx="4" {...lime} fill={colors.surface} />
          <Rect x="100" y="100" width="32" height="34" rx="4" {...white} fill={colors.surface} />
          <Path
            d="M80 24 L84 34 L95 35 L87 42 L89 53 L80 47 L71 53 L73 42 L65 35 L76 34 Z"
            {...lime}
          />
          <Path d="M44 108 V120 M116 116 V124" {...grey} />
        </G>
      );
    case 'heart':
      return (
        <G>
          <Path
            d="M80 128 C44 100 32 80 32 62 C32 46 44 36 58 36 C68 36 76 42 80 50 C84 42 92 36 102 36 C116 36 128 46 128 62 C128 80 116 100 80 128 Z"
            {...lime}
            fill={colors.surface}
          />
          <Path d="M56 62 C56 56 60 54 64 54" {...white} />
        </G>
      );
    case 'run':
      return (
        <G>
          <Path
            d="M28 126 C48 126 52 98 72 98 C96 98 92 70 116 66"
            {...grey}
            strokeDasharray="2 8"
          />
          <Circle cx="104" cy="44" r="9" {...lime} />
          <Path
            d="M104 54 L96 78 L112 92 M96 78 L80 84 L72 70 M100 64 L116 70 M110 96 L116 120"
            {...white}
          />
          <Path d="M104 54 L100 64" {...lime} />
        </G>
      );
    case 'steps':
      return (
        <G>
          <Path
            d="M50 108 C42 104 42 90 50 84 C58 78 66 86 64 96 C63 104 58 112 50 108 Z"
            {...white}
            fill={colors.surface}
          />
          <Path d="M52 118 H60" {...grey} />
          <Path
            d="M98 74 C90 70 90 56 98 50 C106 44 114 52 112 62 C111 70 106 78 98 74 Z"
            {...lime}
            fill={colors.surface}
          />
          <Path d="M100 84 H108" {...grey} />
        </G>
      );
    case 'trophy':
      return (
        <G>
          <Path
            d="M54 30 H106 V64 C106 82 94 92 80 92 C66 92 54 82 54 64 Z"
            {...lime}
            fill={colors.surface}
          />
          <Path d="M54 40 H38 C38 58 46 66 56 68 M106 40 H122 C122 58 114 66 104 68" {...white} />
          <Path d="M80 92 V112 M60 128 H100 M66 112 H94" {...white} />
          <Path d="M70 50 L78 58 L92 42" {...lime} />
        </G>
      );
    case 'friends':
      return (
        <G>
          <Circle cx="58" cy="54" r="14" {...white} />
          <Path d="M32 112 C32 92 44 82 58 82 C72 82 84 92 84 112" {...white} />
          <Circle cx="108" cy="62" r="12" {...lime} />
          <Path d="M88 112 C88 96 98 88 108 88 C118 88 128 96 128 112" {...lime} />
          <Path d="M76 34 L84 42 M92 28 L92 38" {...grey} />
        </G>
      );
    case 'phone':
      return (
        <G>
          <Rect x="48" y="22" width="64" height="116" rx="12" {...white} fill={colors.surface} />
          <Path d="M72 32 H88" {...grey} />
          <Circle cx="80" cy="80" r="18" {...lime} />
          <Path d="M71 80 L78 87 L90 72" {...lime} />
          <Path d="M64 118 H96" {...grey} />
        </G>
      );
    case 'calendar':
      return (
        <G>
          <Rect x="36" y="38" width="88" height="86" rx="10" {...white} fill={colors.surface} />
          <Path d="M36 62 H124 M60 28 V46 M100 28 V46" {...white} />
          <Circle cx="62" cy="84" r="5" fill={colors.textMuted} />
          <Circle cx="80" cy="84" r="5" fill={colors.textMuted} />
          <Circle cx="98" cy="84" r="5" fill={colors.accent} />
          <Circle cx="62" cy="104" r="5" fill={colors.accent} />
          <Circle cx="80" cy="104" r="5" fill={colors.textMuted} />
        </G>
      );
    case 'share':
      return (
        <G>
          <Rect x="44" y="24" width="72" height="112" rx="10" {...white} fill={colors.surface} />
          <Path d="M56 112 C66 96 74 104 82 90 C90 76 100 88 106 70" {...lime} />
          <Circle cx="106" cy="70" r="3" fill={colors.accent} />
          <Path d="M56 46 H84 M56 58 H72" {...grey} />
          <Path d="M124 60 L140 48 M124 72 L142 72" {...grey} />
        </G>
      );
    case 'lock':
      return (
        <G>
          <Rect x="42" y="68" width="76" height="62" rx="10" {...white} fill={colors.surface} />
          <Path d="M58 68 V54 C58 40 66 32 80 32 C94 32 102 40 102 54 V68" {...lime} />
          <Circle cx="80" cy="96" r="7" {...lime} />
          <Path d="M80 103 V114" {...lime} />
        </G>
      );
    case 'bolt':
      return (
        <G>
          <Path d="M90 22 L52 90 H78 L70 138 L110 66 H84 Z" {...lime} fill={colors.surface} />
        </G>
      );
    case 'map':
      return (
        <G>
          <Path
            d="M32 44 L62 32 L98 46 L128 34 V118 L98 130 L62 116 L32 128 Z"
            {...white}
            fill={colors.surface}
          />
          <Path d="M62 32 V116 M98 46 V130" {...grey} />
          <Path d="M44 108 C60 92 68 104 82 86 C94 70 108 82 116 56" {...lime} />
          <Circle cx="116" cy="56" r="4" fill={colors.accent} />
        </G>
      );
  }
}

/**
 * Own line illustrations in the PUSH style: dark surface, white and grey lines, lime as the
 * one accent. Decorative; screens carry the meaning in their texts, so it is hidden from
 * screen readers.
 */
export function Art({ name, size = 144 }: ArtProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Sparkles />
      <Drawing name={name} />
    </Svg>
  );
}
