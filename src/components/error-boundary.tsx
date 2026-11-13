import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

import { Button } from './button';
import { Text } from './text';

type Props = {
  children: ReactNode;
  /** Called with every caught error (crash reporting plugs in here). */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { failed: boolean };

/**
 * Catches errors thrown while rendering so the app shows a calm screen with a retry button
 * instead of closing. Retrying renders the app again from the top.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text variant="title" align="center">
          {de.errorBoundary.title}
        </Text>
        <Text color="textSecondary" align="center">
          {de.errorBoundary.text}
        </Text>
        <Button label={de.errorBoundary.retry} onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
});
