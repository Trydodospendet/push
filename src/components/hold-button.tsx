import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useAnimatedValue,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { hapticSelect, hapticSuccess, hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { playSound } from '@/features/preferences/sounds';
import { colors, glow, layout, radius, spacing } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export type HoldButtonProps = {
  /** Text while idle, e.g. "5 Pfand setzen". */
  label: string;
  /** Text while the finger is held down. */
  holdingLabel: string;
  /** Spoken hint, e.g. "Gedrückt halten, bis der Knopf voll ist". */
  accessibilityHint: string;
  /** Called once when the button has been held long enough. */
  onComplete: () => void;
  /** How long the finger has to stay down. */
  holdMs?: number;
  disabled?: boolean;
  /** Shows a spinner after completion while the action is running. */
  loading?: boolean;
  testID?: string;
};

export const HOLD_MS = 800;

/**
 * Button that fills up while it is held and fires only when it is full – a deliberate "press and
 * hold to commit" gesture with haptic ticks on the way. Letting go early springs the fill back.
 * With a screen reader (or reduced motion) a normal activation is enough, because holding a
 * finger down is not possible there.
 */
export function HoldButton({
  label,
  holdingLabel,
  accessibilityHint,
  onComplete,
  holdMs = HOLD_MS,
  disabled = false,
  loading = false,
  testID,
}: HoldButtonProps) {
  const motionEnabled = useMotionEnabled();
  const fill = useAnimatedValue(0);
  const pop = useAnimatedValue(1);
  const [width, setWidth] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'holding' | 'done'>('idle');
  const [screenReader, setScreenReader] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef<'idle' | 'holding' | 'done'>('idle');

  const changePhase = useCallback((next: 'idle' | 'holding' | 'done') => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (active) {
          setScreenReader(value);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const complete = useCallback(() => {
    clearTimers();
    changePhase('done');
    fill.stopAnimation();
    fill.setValue(1);
    hapticSuccess();
    playSound('success');
    if (motionEnabled) {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.06, duration: 110, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    onComplete();
  }, [changePhase, clearTimers, fill, motionEnabled, onComplete, pop]);

  const start = () => {
    if (disabled || loading || phaseRef.current === 'holding') {
      return;
    }
    changePhase('holding');
    hapticTap();
    playSound('tick');
    fill.setValue(0);
    if (motionEnabled) {
      Animated.timing(fill, {
        toValue: 1,
        duration: holdMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    } else {
      fill.setValue(1);
    }
    [0.25, 0.5, 0.75].forEach((share) => {
      timers.current.push(
        setTimeout(() => {
          hapticSelect();
          playSound('tick');
        }, holdMs * share),
      );
    });
    timers.current.push(setTimeout(complete, holdMs));
  };

  const release = () => {
    if (phaseRef.current !== 'holding') {
      return;
    }
    clearTimers();
    changePhase('idle');
    if (motionEnabled) {
      fill.stopAnimation();
      Animated.spring(fill, {
        toValue: 0,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      fill.setValue(0);
    }
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const inactive = disabled || loading;

  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPressIn={start}
        onPressOut={release}
        onPress={() => {
          if (screenReader && phaseRef.current !== 'done') {
            complete();
          }
        }}
        testID={testID}
        onLayout={onLayout}
        style={[styles.base, !inactive && styles.glowing, disabled && styles.disabled]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              width,
              transform: [
                { translateX: fill.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) },
              ],
            },
          ]}
        />
        <View style={styles.content} pointerEvents="none">
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : phase === 'done' ? (
            <Icon name="checkmark" color="onAccent" />
          ) : (
            <Text variant="button" color={phase === 'holding' ? 'onAccent' : 'text'} align="center">
              {phase === 'holding' ? holdingLabel : label}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    minHeight: layout.buttonHeight + spacing.sm,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  glowing: {
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 12, spreadDistance: 1, color: glow.soft }],
  },
  disabled: {
    opacity: 0.5,
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.accent,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
