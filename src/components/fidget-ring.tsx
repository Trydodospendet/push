import { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useAnimatedValue,
  View,
  type HostInstance,
} from 'react-native';

import { hapticSelect, hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { playSound } from '@/features/preferences/sounds';
import { layout } from '@/theme';

import { ProgressRing, type ProgressRingProps } from './progress-ring';

/** Degrees of turning between two ticks. */
const TICK_DEGREES = 24;
/** The ring never winds up further than two full turns. */
const MAX_DEGREES = 720;
/** A touch that moves less than this many points counts as a tap. */
const TAP_SLOP = 6;

function angleOf(x: number, y: number, centerX: number, centerY: number): number {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
}

/**
 * Progress ring that can be turned with a finger and springs back when let go. A tap makes it
 * bounce. Everything runs on the native driver; with animations off (or the system option
 * "reduce motion") the ring stays still and only gives haptic feedback.
 */
export function FidgetRing(props: ProgressRingProps) {
  const motionEnabled = useMotionEnabled();
  const spin = useAnimatedValue(0);
  const scale = useAnimatedValue(1);
  const root = useRef<HostInstance>(null);
  const gesture = useRef({ center: { x: 0, y: 0 }, last: 0, total: 0, ticks: 0 });

  const responder = useMemo(
    () =>
      // Gesture callbacks read refs only when a touch occurs.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          spin.stopAnimation();
          gesture.current.total = 0;
          gesture.current.ticks = 0;
          const { pageX, pageY } = event.nativeEvent;
          root.current?.measure((_x, _y, width, height, left, top) => {
            gesture.current.center = { x: left + width / 2, y: top + height / 2 };
            gesture.current.last = angleOf(
              pageX,
              pageY,
              gesture.current.center.x,
              gesture.current.center.y,
            );
          });
          gesture.current.last = Number.NaN;
        },
        onPanResponderMove: (event) => {
          if (!motionEnabled) {
            return;
          }
          const state = gesture.current;
          const { pageX, pageY } = event.nativeEvent;
          const angle = angleOf(pageX, pageY, state.center.x, state.center.y);
          if (Number.isNaN(state.last)) {
            state.last = angle;
            return;
          }
          let delta = angle - state.last;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          state.last = angle;
          state.total = Math.max(-MAX_DEGREES, Math.min(MAX_DEGREES, state.total + delta));
          spin.setValue(state.total);
          const ticks = Math.trunc(state.total / TICK_DEGREES);
          if (ticks !== state.ticks) {
            state.ticks = ticks;
            hapticSelect();
            playSound('tick');
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          const moved = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);
          if (moved < TAP_SLOP) {
            hapticTap();
            playSound('pop');
            if (motionEnabled) {
              Animated.sequence([
                Animated.timing(scale, { toValue: 1.07, duration: 90, useNativeDriver: true }),
                Animated.spring(scale, {
                  toValue: 1,
                  friction: 3,
                  tension: 140,
                  useNativeDriver: true,
                }),
              ]).start();
            }
          }
          if (motionEnabled) {
            Animated.spring(spin, {
              toValue: 0,
              friction: 4,
              tension: 38,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (motionEnabled) {
            Animated.spring(spin, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [motionEnabled, scale, spin],
  );

  return (
    <View ref={root} style={styles.root} {...responder.panHandlers}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <ProgressRing {...props} spin={spin} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: layout.ring.size,
    height: layout.ring.size,
    alignSelf: 'center',
  },
});
