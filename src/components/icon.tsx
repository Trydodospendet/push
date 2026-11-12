import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { colors, layout, type ColorToken } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type IconProps = {
  name: IconName;
  color?: ColorToken;
  size?: number;
};

/**
 * Decorative icon. Icons are hidden from screen readers; the surrounding button or row
 * carries the accessibilityLabel.
 */
export function Icon({ name, color = 'text', size = layout.iconSize }: IconProps) {
  return (
    <Ionicons
      name={name}
      color={colors[color]}
      size={size}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
