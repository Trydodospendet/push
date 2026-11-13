import { StyleSheet, View } from 'react-native';

import { colors, layout, radius, spacing } from '@/theme';

import { Art, type ArtName } from './art';
import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  text: string;
  /** The one clear next step. */
  actionLabel?: string;
  onAction?: () => void;
  /** Smaller illustration for sections inside a longer screen. */
  compact?: boolean;
};

/** The own illustration that belongs to an icon name; unknown icons get the target. */
function artForIcon(icon: IconName): ArtName {
  if (icon.startsWith('trophy')) return 'podium';
  if (icon.startsWith('flag')) return 'flag';
  if (icon.startsWith('search')) return 'target';
  if (icon.startsWith('checkmark')) return 'trophy';
  if (icon.startsWith('wallet') || icon.startsWith('cash')) return 'coins';
  if (icon.startsWith('heart')) return 'heart';
  if (icon.startsWith('people')) return 'friends';
  if (icon.startsWith('walk') || icon.startsWith('footsteps')) return 'steps';
  return 'target';
}

/** Illustration, short explanation and one clear action instead of an empty list. */
export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <Art
        name={artForIcon(icon)}
        size={compact ? layout.illustration.compactSize : layout.illustration.size}
      />
      <View style={styles.texts}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text color="textSecondary" align="center">
          {text}
        </Text>
      </View>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

/** A big icon in a double circle with two small dots. Only plain views, no image files. */
export function Illustration({
  icon,
  size = layout.illustration.size,
}: {
  icon: IconName;
  size?: number;
}) {
  const inner = size * 0.7;
  const compact = size < layout.illustration.size;
  return (
    <View
      style={[styles.outer, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.inner, { width: inner, height: inner }]}>
        <Icon
          name={icon}
          color="accent"
          size={compact ? layout.illustration.iconSize / 2 : layout.illustration.iconSize}
        />
      </View>
      {compact ? null : (
        <>
          <View style={[styles.dot, styles.dotLarge]} />
          <View style={[styles.dot, styles.dotSmall]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'stretch',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  texts: {
    gap: spacing.xs,
  },
  outer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  dot: {
    position: 'absolute',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  dotLarge: {
    width: spacing.sm,
    height: spacing.sm,
    top: spacing.md,
    right: spacing.sm,
  },
  dotSmall: {
    width: spacing.xs,
    height: spacing.xs,
    bottom: spacing.lg,
    left: spacing.xxs,
    backgroundColor: colors.textMuted,
  },
});
