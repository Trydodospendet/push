import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { hapticSelect } from '@/features/preferences/haptics';
import { colors, layout, spacing, topLightOpacity } from '@/theme';

/** Faint lime light falling from the top edge; decorative only. */
function TopLight() {
  return (
    <View pointerEvents="none" style={styles.topLight}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="topLight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={topLightOpacity} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#topLight)" />
      </Svg>
    </View>
  );
}

export const ScreenHeaderContext = createContext(false);

export type ScreenProps = {
  children: ReactNode;
  /** Makes the content scrollable for screens that can exceed the viewport. */
  scroll?: boolean;
  /** Pull-to-refresh; only used together with `scroll`. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Pull down to reload: a standard refresh control is added; only used together with `scroll`. */
  onRefresh?: () => Promise<unknown> | void;
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
  onRefresh,
  contentStyle,
  edges,
  testID,
}: ScreenProps) {
  const hasHeader = useContext(ScreenHeaderContext);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const control =
    refreshControl ??
    (onRefresh ? (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => {
          hapticSelect();
          setRefreshing(true);
          void Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
        }}
        tintColor={colors.accent}
        colors={[colors.onAccent]}
        progressBackgroundColor={colors.accent}
      />
    ) : undefined);
  // Inside the tabs the content ends with room for the tab bar and the system navigation.
  const bottomSpace = hasHeader ? layout.tabBarHeight + insets.bottom : 0;
  return (
    <SafeAreaView
      style={styles.root}
      edges={edges ?? (hasHeader ? ['bottom', 'left', 'right'] : undefined)}
      testID={testID}
    >
      <TopLight />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={control}
        >
          {children}
          {bottomSpace > 0 ? <View style={{ height: bottomSpace }} /> : null}
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
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  topLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
