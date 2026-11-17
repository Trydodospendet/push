import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Pushy, PUSHY_HEIGHT } from '@/features/coach/pushy';
import type { PushyPose } from '@/features/fur/images';
import { hapticTap } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { colors, layout, spacing, typography } from '@/theme';

import { Text } from './text';

export type EditorialHeroProps = {
  /** The huge word behind Pushy, e.g. "PUSH" or "3 KM". Kept short. */
  word: string;
  /** Small spaced uppercase label above, e.g. "HEUTE · LAUF · 3 KM". */
  label: string;
  /** Pushy in front of the word; tapping puts him to sleep and wakes him up. */
  pose: PushyPose;
  /** Something else in front of the word (e.g. the profile picture) instead of Pushy. */
  front?: ReactNode;
  /** Horizontal padding of the parent that the hero reaches across (0 when it has none). */
  inset?: number;
  /** Extra room at the top, e.g. for a transparent header. */
  topInset?: number;
};

const HERO_HEIGHT = 300;
const PUSHY_SCALE = 2.3;
const WORD_SIZE = 150;

/**
 * Magazine-cover header: a dark lime gradient, a giant word across the full width and Pushy
 * standing in front so that he overlaps the lower part of the letters. Decorative except for the
 * label and Pushy's button.
 */
export function EditorialHero({
  word,
  label,
  pose,
  front,
  inset = spacing.lg,
  topInset = 0,
}: EditorialHeroProps) {
  const { width } = useWindowDimensions();
  const [asleep, setAsleep] = useState(false);
  const height = HERO_HEIGHT + topInset;

  return (
    <View style={[styles.root, { height, marginHorizontal: -inset }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.heroTop} stopOpacity={1} />
            <Stop offset="0.6" stopColor={colors.heroMid} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#heroFill)" />
      </Svg>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.word, { top: topInset + spacing.xl }]}
      >
        {word}
      </Text>
      <Text
        variant="label"
        color="textSecondary"
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.label, { top: topInset + spacing.md }]}
      >
        {label}
      </Text>
      {front ? (
        <View style={styles.front}>{front}</View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={asleep ? de.coach.wake : de.coach.sleep}
          onPress={() => {
            hapticTap();
            setAsleep((value) => !value);
          }}
          style={styles.pushy}
        >
          <Pushy pose={asleep ? 'sleep' : pose} scale={PUSHY_SCALE} />
          {asleep ? (
            <Text variant="heading" color="accent" style={styles.zzz}>
              {de.coach.zzz}
            </Text>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', alignItems: 'center' },
  label: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    letterSpacing: 3,
  },
  word: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    fontFamily: typography.display.fontFamily,
    fontSize: WORD_SIZE,
    lineHeight: WORD_SIZE,
    letterSpacing: -8,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: colors.accent,
    opacity: 0.17,
  },
  pushy: {
    position: 'absolute',
    bottom: 0,
    minWidth: layout.minTouchTarget,
    minHeight: PUSHY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  front: { position: 'absolute', bottom: spacing.lg, alignItems: 'center' },
  zzz: { position: 'absolute', top: spacing.md, right: -spacing.sm },
});
