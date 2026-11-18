import { StyleSheet, View } from 'react-native';

import { ProgressBar, ProgressRing, Text } from '@/components';
import { FurNumber } from '@/features/fur/fur-number';
import { spacing } from '@/theme';

const NUMBER_HEIGHT = 64;
const NUMBER_WIDTH = 150;
const COMPACT_SIZE = 204;

/**
 * The goal picture of Home and of the run screen: a slim bar for the goal on top, below it the
 * lime ring with the fur number (km or steps) in the middle and "von 3,00 km" under it.
 */
export function GoalRing({
  ratio,
  value,
  caption,
  spoken,
  barLabel,
  compact = false,
}: {
  /** Share of the goal, 0 to 1. */
  ratio: number;
  /** The number in the middle, e.g. '3,25'. */
  value: string;
  /** Line under the number, e.g. 'von 5,00 km'. */
  caption?: string;
  /** Screen reader text for the ring and the bar. */
  spoken: string;
  barLabel: string;
  /** A smaller ring for the run panel. */
  compact?: boolean;
}) {
  return (
    <View style={styles.root}>
      <ProgressBar progress={ratio} accessibilityLabel={`${barLabel}: ${spoken}`} />
      <ProgressRing
        progress={ratio}
        accessibilityLabel={spoken}
        size={compact ? COMPACT_SIZE : undefined}
      >
        <FurNumber
          value={value}
          height={compact ? NUMBER_HEIGHT * 0.8 : NUMBER_HEIGHT}
          maxWidth={compact ? NUMBER_WIDTH * 0.8 : NUMBER_WIDTH}
          label={spoken}
        />
        {caption ? (
          <Text color="textSecondary" align="center" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </ProgressRing>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, alignItems: 'stretch' },
});
