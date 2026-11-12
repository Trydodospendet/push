import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme';

import { Text } from './text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Shown below the field in red; also marks the field as invalid. */
  error?: string | null;
  /** Neutral help text below the field, hidden while an error is shown. */
  hint?: string;
};

export function TextField({ label, error, hint, onFocus, onBlur, ...rest }: TextFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const message = error ?? hint;

  return (
    <View style={styles.root}>
      <Text variant="label" color="textSecondary" nativeID={`${id}-label`}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={message}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, focused && styles.focused, error ? styles.invalid : null]}
        {...rest}
      />
      {message ? (
        <Text
          variant="caption"
          color={error ? 'danger' : 'textMuted'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focused: {
    borderColor: colors.textSecondary,
  },
  invalid: {
    borderColor: colors.danger,
  },
});
