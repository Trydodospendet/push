import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useAnimatedValue,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotionEnabled } from '@/features/preferences/motion';
import { colors, layout, radius, spacing } from '@/theme';

export type DraggablePanelProps = {
  /** Always visible: the part that stays when the panel is pulled down. */
  header: ReactNode;
  children?: ReactNode;
  /** Share of the screen height when pulled up (0 to 1). */
  maxShare?: number;
  startCollapsed?: boolean;
  /** Called with the visible height, so the map can keep its subject above the panel. */
  onHeight?: (height: number) => void;
  toggleLabel: string;
};

const HANDLE_AREA = 28;

/**
 * A panel over a full-screen map that can be pulled up and down (or tapped on its handle for
 * the same effect, which also works with screen readers). Over a map it is the place for
 * numbers and charts; the map stays visible above it.
 */
export function DraggablePanel({
  header,
  children,
  maxShare = 0.62,
  startCollapsed = false,
  onHeight,
  toggleLabel,
}: DraggablePanelProps) {
  const motionOn = useMotionEnabled();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const maxHeight = Math.round(screenHeight * maxShare);
  const peek = useRef(0);
  const offset = useAnimatedValue(0);
  const current = useRef(0);
  const collapsed = useRef(startCollapsed);
  const startY = useRef(0);

  const travel = () => Math.max(0, maxHeight - peek.current);

  const snap = (toCollapsed: boolean) => {
    collapsed.current = toCollapsed;
    const target = toCollapsed ? travel() : 0;
    current.current = target;
    onHeight?.(maxHeight - target);
    if (!motionOn) {
      offset.setValue(target);
      return;
    }
    Animated.spring(offset, {
      toValue: target,
      friction: 9,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    offset.setValue(startCollapsed ? travel() : 0);
    current.current = startCollapsed ? travel() : 0;
    onHeight?.(maxHeight - current.current);
    // Only once, when the layout is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The responder only touches the refs inside its gesture callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        startY.current = current.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const next = Math.min(travel(), Math.max(0, startY.current + gesture.dy));
        offset.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        const position = Math.min(travel(), Math.max(0, startY.current + gesture.dy));
        const goDown = gesture.vy > 0.4 || (Math.abs(gesture.vy) <= 0.4 && position > travel() / 2);
        snap(goDown);
      },
    }),
  );

  return (
    <Animated.View
      style={[
        styles.panel,
        { height: maxHeight, paddingBottom: insets.bottom + spacing.sm },
        { transform: [{ translateY: offset }] },
      ]}
    >
      <View {...responder.panHandlers} style={styles.handleArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          onPress={() => snap(!collapsed.current)}
          style={styles.handleHit}
        >
          <View style={styles.handle} />
        </Pressable>
      </View>
      <View
        onLayout={(event) => {
          peek.current = HANDLE_AREA + event.nativeEvent.layout.height + insets.bottom + spacing.sm;
          if (collapsed.current) {
            offset.setValue(travel());
            current.current = travel();
          }
        }}
        style={styles.header}
      >
        {header}
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
    borderBottomWidth: 0,
  },
  handleArea: {
    height: HANDLE_AREA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleHit: {
    minWidth: layout.minTouchTarget * 2,
    minHeight: HANDLE_AREA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: spacing.xl + spacing.sm,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  header: {
    paddingHorizontal: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
});
