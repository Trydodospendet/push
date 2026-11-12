import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

/** Centered spinner for content that is still loading. */
export function LoadingState({ label = de.common.loading }: { label?: string }) {
  return (
    <View
      style={styles.center}
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator color={colors.accent} size="large" />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
