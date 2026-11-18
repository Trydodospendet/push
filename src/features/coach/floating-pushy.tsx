import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useAnimatedValue,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import type { PushyPose } from '@/features/fur/images';
import { hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { playSound } from '@/features/preferences/sounds';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

import { countReversals, isNight, snapX } from './model';
import { PUSHY_HEIGHT, PUSHY_WIDTH, Pushy } from './pushy';

const SCALE = 0.72;
const BOX_WIDTH = Math.round(PUSHY_WIDTH * SCALE);
const BOX_HEIGHT = Math.round(PUSHY_HEIGHT * SCALE);
const EDGE_MARGIN = 4;
const HEADER_SPACE = 56;
const TAP_DISTANCE = 8;
const FLING_SPEED = 1.6;
const SHAKE_REVERSALS = 4;
const MESSAGE_MS = 6000;
const DIZZY_MS = 2200;
const BUBBLE_WIDTH = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pushy as a small helper that floats at the edge of the screen. He can be dragged and swirled
 * around (and lets go at the nearest side edge, so he never sits on the buttons), tapping him
 * opens a little bubble with a tip, wiggling him makes him dizzy, and at night he sleeps.
 */
export function FloatingPushy() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotionEnabled();
  const minY = insets.top + HEADER_SPACE;
  const maxY = height - layout.tabBarHeight - insets.bottom - BOX_HEIGHT - spacing.md;

  const [pan] = useState(
    () => new Animated.ValueXY({ x: width - BOX_WIDTH - EDGE_MARGIN, y: maxY - 120 }),
  );
  const tilt = useAnimatedValue(0);
  const spin = useAnimatedValue(0);
  const place = useRef({ x: width - BOX_WIDTH - EDGE_MARGIN, y: maxY - 120 });
  const start = useRef({ x: 0, y: 0 });
  const trail = useRef<number[]>([]);
  const bounds = useRef({ width, minY, maxY, motion });

  const [dragging, setDragging] = useState(false);
  const [dizzy, setDizzy] = useState(false);
  const [asleep, setAsleep] = useState(() => isNight(new Date().getHours()));
  const [message, setMessage] = useState<string | null>(null);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [low, setLow] = useState(true);
  const tips = useRef(0);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dizzyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asleepRef = useRef(asleep);

  useEffect(() => {
    const id = pan.addListener((value) => {
      place.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  useEffect(() => {
    const timer = setInterval(() => setAsleep(isNight(new Date().getHours())), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
      if (dizzyTimer.current) clearTimeout(dizzyTimer.current);
    },
    [],
  );

  const say = (text: string) => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(text);
    messageTimer.current = setTimeout(() => setMessage(null), MESSAGE_MS);
  };

  const makeDizzy = () => {
    if (dizzyTimer.current) return;
    setDizzy(true);
    say(de.coach.dizzy);
    dizzyTimer.current = setTimeout(() => {
      dizzyTimer.current = null;
      setDizzy(false);
    }, DIZZY_MS);
  };

  const onTap = () => {
    hapticTap();
    playSound('pop');
    if (asleepRef.current) {
      say(de.coach.asleep);
      return;
    }
    tips.current += 1;
    say(de.coach.tips[tips.current % de.coach.tips.length]);
  };

  const finish = (tapped: boolean, speed: number) => {
    const limit = bounds.current;
    setDragging(false);
    const x = snapX(place.current.x, limit.width, BOX_WIDTH, EDGE_MARGIN);
    const y = clamp(place.current.y, limit.minY, limit.maxY);
    setSide(x < limit.width / 2 ? 'left' : 'right');
    setLow(y > limit.minY + 140);
    Animated.spring(pan, {
      toValue: { x, y },
      friction: 7,
      tension: 90,
      useNativeDriver: false,
    }).start();
    Animated.spring(tilt, { toValue: 0, friction: 4, useNativeDriver: true }).start();
    if (!tapped && speed > FLING_SPEED && limit.motion) {
      spin.setValue(0);
      Animated.timing(spin, { toValue: 360, duration: 500, useNativeDriver: true }).start(() =>
        spin.setValue(0),
      );
    }
    if (tapped) onTap();
  };
  const finishRef = useRef(finish);
  const dizzyRef = useRef(makeDizzy);

  // Handlers always read the latest values through refs; they are updated after each render.
  useEffect(() => {
    bounds.current = { width, minY, maxY, motion };
    asleepRef.current = asleep;
    finishRef.current = finish;
    dizzyRef.current = makeDizzy;
  });

  // The responder only touches the refs inside its gesture callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pan.stopAnimation();
        start.current = { ...place.current };
        trail.current = [];
        setDragging(true);
      },
      onPanResponderMove: (_event, g) => {
        const limit = bounds.current;
        pan.setValue({
          x: clamp(start.current.x + g.dx, 0, limit.width - BOX_WIDTH),
          y: clamp(start.current.y + g.dy, limit.minY, limit.maxY),
        });
        tilt.setValue(clamp(g.vx * 14, -35, 35));
        trail.current = [...trail.current.slice(-30), g.dx];
        if (countReversals(trail.current, 18) >= SHAKE_REVERSALS) {
          trail.current = [];
          dizzyRef.current();
        }
      },
      onPanResponderRelease: (_event, g) => {
        finishRef.current(Math.hypot(g.dx, g.dy) < TAP_DISTANCE, Math.hypot(g.vx, g.vy));
      },
      onPanResponderTerminate: () => finishRef.current(false, 0),
    }),
  );

  const pose: PushyPose = asleep
    ? 'sleep'
    : dizzy
      ? 'dizzy'
      : dragging
        ? 'run'
        : message
          ? 'wave'
          : 'sit';
  const rotate = Animated.add(tilt, spin).interpolate({
    inputRange: [-360, 720],
    outputRange: ['-360deg', '720deg'],
  });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.box, { transform: pan.getTranslateTransform() }]}
      >
        {message ? (
          <View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={[
              styles.bubble,
              side === 'left' ? styles.bubbleLeft : styles.bubbleRight,
              low ? styles.bubbleAbove : styles.bubbleBelow,
            ]}
          >
            <Text variant="caption">{message}</Text>
          </View>
        ) : null}
        <View
          {...responder.panHandlers}
          accessible
          accessibilityRole="button"
          accessibilityLabel={asleep ? de.coach.asleep : de.coach.label}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={onTap}
          style={styles.touch}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Pushy pose={pose} scale={SCALE} />
          </Animated.View>
          {asleep ? (
            <Text variant="caption" color="accent" style={styles.zzz}>
              {de.coach.zzz}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0, top: 0, width: BOX_WIDTH, height: BOX_HEIGHT },
  touch: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zzz: { position: 'absolute', top: 0, right: 0 },
  bubble: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  bubbleLeft: { left: 0 },
  bubbleRight: { right: 0 },
  bubbleAbove: { bottom: BOX_HEIGHT + spacing.xs },
  bubbleBelow: { top: BOX_HEIGHT + spacing.xs },
});
