import { StyleSheet, Switch, View } from 'react-native';

import { colors, layout, spacing } from '@/theme';

import { Text } from './text';

export type SwitchRowProps = {
  label: string;
  /** Short explanation below the label. */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/** A setting that is on or off: label and hint on the left, the switch on the right. */
export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  disabled = false,
  testID,
}: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text>{label}</Text>
        {hint ? (
          <Text variant="caption" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  text: {
    flex: 1,
  },
});
