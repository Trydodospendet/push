import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, useAnimatedValue } from 'react-native';

import { Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { hapticSelect, hapticSuccess } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { useClaimLogoBadge } from './api';

const TAPS_NEEDED = 7;
const WINDOW_MS = 4000;

/**
 * The wordmark at the bottom of the profile. Tapping it seven times within four seconds is a
 * secret: the logo hops and a hidden badge is unlocked.
 */
export function LogoEgg() {
  const userId = useSession().user.id;
  const claim = useClaimLogoBadge(userId);
  const motionOn = useMotionEnabled();
  const hop = useAnimatedValue(0);
  const taps = useRef<number[]>([]);

  const onPress = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time < WINDOW_MS), now];
    hapticSelect();
    if (motionOn) {
      hop.setValue(0);
      Animated.sequence([
        Animated.timing(hop, { toValue: -8, duration: 90, useNativeDriver: true }),
        Animated.spring(hop, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    if (taps.current.length >= TAPS_NEEDED) {
      taps.current = [];
      hapticSuccess();
      claim.mutate();
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="text"
      accessibilityLabel={de.badges.logoHint}
      style={styles.root}
    >
      <Animated.View style={{ transform: [{ translateY: hop }] }}>
        <Text variant="heading" color="textMuted" align="center">
          {de.welcome.logo}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
