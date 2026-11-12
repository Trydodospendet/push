import { StyleSheet, View } from 'react-native';

import { colors, layout, radius, spacing } from '@/theme';

import { Text } from './text';

export type PillProps = {
  label: string;
  /** `accent` (lime) only for positive states such as "Dabei" or "geschafft". */
  tone?: 'neutral' | 'accent';
};

/** Small status label, e.g. "Offen" or "Dabei". Not tappable. */
export function Pill({ label, tone = 'neutral' }: PillProps) {
  return (
    <View style={[styles.base, tone === 'accent' && styles.accent]}>
      <Text variant="caption" color={tone === 'accent' ? 'onAccent' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs / 2,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
