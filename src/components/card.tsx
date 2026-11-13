import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, layout, radius, spacing } from '@/theme';

export type CardProps = ViewProps & {
  /** Uses the lighter surface, e.g. for a card placed on another card. */
  raised?: boolean;
};

export function Card({ raised = false, style, ...rest }: CardProps) {
  return <View style={[styles.base, raised && styles.raised, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
    borderRadius: radius.card,
    padding: spacing.md,
    elevation: 3,
    shadowColor: colors.bg,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  raised: {
    backgroundColor: colors.surfaceRaised,
  },
});
