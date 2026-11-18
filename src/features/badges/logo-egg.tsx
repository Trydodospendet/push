import { useRef } from 'react';
import { Animated, Pressable, useAnimatedValue } from 'react-native';

import { useSession } from '@/features/auth/auth-provider';
import { hapticSelect, hapticSuccess } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import type { ReactNode } from 'react';

import { useClaimLogoBadge } from './api';

const TAPS_NEEDED = 7;
const WINDOW_MS = 4000;

/**
 * Wraps the profile picture. Tapping it seven times within four seconds is a secret: it hops
 * and a hidden badge is unlocked.
 */
export function LogoEgg({ children }: { children: ReactNode }) {
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
    <Pressable onPress={onPress} accessible={false}>
      <Animated.View style={{ transform: [{ translateY: hop }] }}>{children}</Animated.View>
    </Pressable>
  );
}
