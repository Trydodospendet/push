import { StyleSheet, View } from 'react-native';

import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { Button } from './button';
import { SkeletonCard } from './skeleton';
import { Text } from './text';

/** Grey placeholder cards for content that is still loading (instead of a spinner). */
export function LoadingState({ label = de.common.loading }: { label?: string }) {
  return (
    <View
      style={styles.loading}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
    </View>
  );
}

export type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Centered error message with an optional retry button. */
export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <View style={styles.center}>
      <Text align="center" color="textSecondary" accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? (
        <Button label={de.common.retry} variant="secondary" onPress={onRetry} loading={retrying} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
