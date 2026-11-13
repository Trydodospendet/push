import { useEffect, useRef, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  useAnimatedValue,
  View,
} from 'react-native';

import { Text } from '@/components';
import { useMotionEnabled } from '@/features/preferences/motion';
import { colors, glow, layout, radius, spacing } from '@/theme';

export type CodeInputState = 'idle' | 'error' | 'success';

export type CodeInputProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  state: CodeInputState;
  /** Changes with every wrong attempt; shakes the boxes. */
  shakeKey: number;
  disabled?: boolean;
  accessibilityLabel: string;
  autoFocus?: boolean;
};

/**
 * The code as separate boxes. One invisible text field covers them all, so typing, the
 * system's one-time-code suggestion and long-press "paste" all work like in a normal field.
 * Every digit pops in, the active box glows in lime, a wrong code shakes the row and a right
 * one turns every box lime. Without animations (own switch or system "reduce motion") the
 * states are shown without movement.
 */
export function CodeInput({
  length,
  value,
  onChange,
  state,
  shakeKey,
  disabled = false,
  accessibilityLabel,
  autoFocus = true,
}: CodeInputProps) {
  const motionOn = useMotionEnabled();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useAnimatedValue(0);
  const pulse = useAnimatedValue(0);

  useEffect(() => {
    if (shakeKey === 0 || !motionOn) {
      return;
    }
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [motionOn, shake, shakeKey]);

  useEffect(() => {
    if (!motionOn || state !== 'idle') {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOn, pulse, state]);

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Animated.View style={[styles.root, { transform: [{ translateX: shake }] }]}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, index) => (
          <Box
            key={index}
            char={value[index] ?? ''}
            active={index === activeIndex && state === 'idle' && !disabled}
            state={state}
            motionOn={motionOn}
            pulse={pulse}
            order={index}
          />
        ))}
      </View>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => inputRef.current?.focus()}
        accessibilityRole="none"
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
          style={styles.input}
          caretHidden
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          contextMenuHidden={false}
          selectionColor={colors.accent}
          accessibilityLabel={accessibilityLabel}
          importantForAutofill="yes"
        />
      </Pressable>
    </Animated.View>
  );
}

function Box({
  char,
  active,
  state,
  motionOn,
  pulse,
  order,
}: {
  char: string;
  active: boolean;
  state: CodeInputState;
  motionOn: boolean;
  pulse: Animated.Value;
  order: number;
}) {
  const pop = useAnimatedValue(1);
  const previous = useRef(char);

  useEffect(() => {
    if (char !== '' && previous.current === '' && motionOn) {
      pop.setValue(0.8);
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    previous.current = char;
  }, [char, motionOn, pop]);

  // On success the boxes light up one after the other.
  const win = useAnimatedValue(state === 'success' && !motionOn ? 1 : 0);
  useEffect(() => {
    if (state !== 'success') {
      win.setValue(0);
      return;
    }
    if (!motionOn) {
      win.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.delay(order * 60),
      Animated.spring(win, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [motionOn, order, state, win]);

  const scale = Animated.multiply(
    pop,
    win.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
  );
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  const borderColor =
    state === 'error'
      ? colors.danger
      : state === 'success' || active
        ? colors.accent
        : char !== ''
          ? colors.textSecondary
          : colors.border;

  return (
    <Animated.View style={[styles.box, { borderColor, transform: [{ scale }] }]}>
      {active ? <Animated.View style={[styles.halo, { opacity: haloOpacity }]} /> : null}
      {state === 'success' ? <View style={styles.win} /> : null}
      <Text variant="title" color={state === 'success' ? 'accent' : 'text'} style={styles.digit}>
        {char}
      </Text>
    </Animated.View>
  );
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const BOX_HEIGHT = layout.buttonHeight + spacing.sm;

const styles = StyleSheet.create({
  root: {
    height: BOX_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    ...FILL,
    opacity: 0.02,
    color: colors.bg,
  },
  box: {
    flex: 1,
    height: BOX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  halo: {
    ...FILL,
    backgroundColor: glow.soft,
    borderWidth: spacing.xxs,
    borderColor: glow.strong,
    borderRadius: radius.card,
  },
  win: {
    ...FILL,
    backgroundColor: glow.soft,
  },
  digit: {
    fontVariant: ['tabular-nums'],
  },
});
