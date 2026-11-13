import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type SettingsRowProps = {
  icon: IconName;
  label: string;
  /** Current value or short explanation, shown below the label. */
  detail?: string;
  onPress: () => void;
  testID?: string;
};

/** One line of a settings list: icon, label, detail and a chevron. Opens a screen. */
export function SettingsRow({ icon, label, detail, onPress, testID }: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Icon name={icon} color="accent" />
      </View>
      <View style={styles.text}>
        <Text>{label}</Text>
        {detail ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" color="textMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget + spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  icon: {
    width: layout.minTouchTarget - spacing.sm,
    alignItems: 'center',
  },
  text: {
    flex: 1,
  },
});
