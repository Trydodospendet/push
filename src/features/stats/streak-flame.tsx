import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useAnimatedValue, View } from 'react-native';

import { Icon, Text } from '@/components';
import { hapticSelect, hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { playSound } from '@/features/preferences/sounds';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

import { useMyStats } from './api';

/** How long a flame reaction stays in place of the streak line. */
const REACTION_MS = 2200;

/**
 * Streak flame: one line with the number of days in a row. Tapping the flame makes it flicker,
 * vibrates and shows a short line; it never changes the streak itself.
 */
export function StreakFlame({ userId }: { userId: string }) {
  const stats = useMyStats(userId);
  const motionEnabled = useMotionEnabled();
  const wobble = useAnimatedValue(0);
  const scale = useAnimatedValue(1);
  const [reaction, setReaction] = useState<string | null>(null);
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  if (stats.isPending || stats.isError) {
    return null;
  }
  const streak = stats.data.streakDays;
  const base = streak > 0 ? de.stats.streak(streak) : de.stats.streakNone;

  const poke = () => {
    taps.current += 1;
    hapticTap();
    hapticSelect();
    playSound('pop');
    setReaction(de.stats.flameLines[taps.current % de.stats.flameLines.length]);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setReaction(null), REACTION_MS);
    if (motionEnabled) {
      wobble.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(wobble, { toValue: -1, duration: 70, useNativeDriver: true }),
          Animated.timing(wobble, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.spring(wobble, { toValue: 0, friction: 3, tension: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 90, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
        ]),
      ]).start();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={base}
      accessibilityHint={de.stats.streakHint}
      onPress={poke}
      style={styles.row}
    >
      <Animated.View
        style={[
          styles.flame,
          streak > 0 && styles.flameLit,
          {
            transform: [
              { scale },
              {
                rotate: wobble.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-18deg', '18deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Icon name="flame" color={streak > 0 ? 'onAccent' : 'textMuted'} />
      </Animated.View>
      <View style={styles.text}>
        <Text variant="heading" numberOfLines={1}>
          {reaction ?? base}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
  flame: {
    width: layout.avatar.md,
    height: layout.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  flameLit: {
    backgroundColor: colors.accent,
  },
  text: {
    flexShrink: 1,
  },
});
