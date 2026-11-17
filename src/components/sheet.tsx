import { useMemo, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useAnimatedValue,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotionEnabled } from '@/features/preferences/motion';
import { colors, layout, radius, scrim, spacing } from '@/theme';

import { Text } from './text';

const SWIPE_CLOSE_DISTANCE = 100;

export type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Label for the dimmed backdrop, which closes the sheet when tapped. */
  closeLabel: string;
};

/** Bottom sheet for confirmations (e.g. joining a challenge). */
export function Sheet({ visible, title, onClose, children, closeLabel }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const motionEnabled = useMotionEnabled();
  const drag = useAnimatedValue(0);
  // Swiping the top of the sheet down closes it, like in every other app.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, g) => g.dy > 6,
        onPanResponderMove: (_event, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_event, g) => {
          if (g.dy > SWIPE_CLOSE_DISTANCE || g.vy > 0.8) {
            drag.setValue(0);
            onClose();
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    [drag, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={motionEnabled ? 'slide' : 'none'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: drag }] },
            {
              maxHeight: height - insets.top - spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
          accessibilityViewIsModal
        >
          <View {...swipe.panHandlers} style={styles.swipeArea}>
            <View style={styles.handle} />
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.md }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  swipeArea: {
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xl,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
});
