import { Pressable, StyleSheet, View } from 'react-native';

import { hapticSelect } from '@/features/preferences/haptics';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import { Text } from './text';

export type ChipOption<T> = {
  value: T;
  label: string;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
};

export type ChipGroupProps<T> = {
  /** Small uppercase heading above the chips. */
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
};

/** Single choice from a few presets, shown as pills. The selected pill is white. */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testID,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.root} testID={testID}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                hapticSelect();
                onChange(option.value);
              }}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text variant="button" color={selected ? 'bg' : 'text'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    minHeight: layout.chipHeight,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
