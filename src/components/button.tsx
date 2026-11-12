import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { de } from '@/i18n/de';
import { colors, layout, opacity, radius, spacing } from '@/theme';

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
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const contentColor =
    variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'danger' : 'text';

  return (
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
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[contentColor]} />
      ) : (
        <Text variant="button" color={contentColor} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    minHeight: layout.buttonHeight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    borderWidth: layout.borderWidth,
    borderColor: colors.textMuted,
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
