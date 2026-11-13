import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

export const ScreenHeaderContext = createContext(false);

export type ScreenProps = {
  children: ReactNode;
  /** Makes the content scrollable for screens that can exceed the viewport. */
  scroll?: boolean;
  /** Pull-to-refresh; only used together with `scroll`. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Extra styles for the padded content area. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Safe-area edges to pad; screens below a navigation header leave out 'top'. */
  edges?: readonly Edge[];
  testID?: string;
};

export function Screen({
  children,
  scroll = false,
  refreshControl,
  contentStyle,
  edges,
  testID,
}: ScreenProps) {
  const hasHeader = useContext(ScreenHeaderContext);
  return (
    <SafeAreaView
      style={styles.root}
      edges={edges ?? (hasHeader ? ['bottom', 'left', 'right'] : undefined)}
      testID={testID}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
