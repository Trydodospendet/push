import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { furImages } from '@/features/fur/images';
import { hapticTap } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { colors, glow, layout, opacity, radius, spacing } from '@/theme';

import { GlowPulse } from './glow-pulse';
import { Text } from './text';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * `primary`: lime fill, black text. `secondary`: outline, no fill.
   * `danger`: red outline and text, only for destructive actions (account deletion).
   */
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  /** Furry pill as background with a soft pulsing lime halo (primary buttons only). */
  fur?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fur = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const contentColor =
    variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'danger' : 'text';

  const furry = fur && variant === 'primary';
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        loading
          ? `${accessibilityLabel ?? label}, ${de.common.loading}`
          : (accessibilityLabel ?? label)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        furry && styles.furry,
        variant === 'primary' && !isInactive && !furry && styles.glowing,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {furry ? <FurPill /> : null}
      {loading ? (
        <ActivityIndicator color={colors[contentColor]} />
      ) : (
        <Text variant="button" color={contentColor} align="center">
          {label}
        </Text>
      )}
    </Pressable>
  );
  if (!furry) return button;
  return (
    <GlowPulse radius={layout.buttonHeight / 2} active={!isInactive} style={styles.stretch}>
      {button}
    </GlowPulse>
  );
}

/** Left cap, stretchable middle and right cap of the fur pill: the picture is never distorted. */
function FurPill() {
  return (
    <View pointerEvents="none" style={styles.pill}>
      <Image
        source={furImages.pill.left}
        resizeMode="stretch"
        fadeDuration={0}
        style={styles.cap}
      />
      <Image
        source={furImages.pill.mid}
        resizeMode="stretch"
        fadeDuration={0}
        style={styles.middle}
      />
      <Image
        source={furImages.pill.right}
        resizeMode="stretch"
        fadeDuration={0}
        style={styles.cap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    minHeight: layout.buttonHeight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    borderWidth: layout.borderWidth,
    borderColor: colors.textMuted,
  },
  stretch: { alignSelf: 'stretch' },
  furry: { backgroundColor: 'transparent' },
  pill: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  cap: { width: layout.buttonHeight / 2, height: layout.buttonHeight },
  middle: { flex: 1, height: layout.buttonHeight },
  glowing: {
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 18, spreadDistance: 1, color: glow.button }],
  },
  danger: {
    borderWidth: layout.borderWidth,
    borderColor: colors.danger,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  disabled: {
    opacity: opacity.disabled,
  },
});
