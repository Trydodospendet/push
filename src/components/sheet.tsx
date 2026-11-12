import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, scrim, spacing } from '@/theme';

import { Text } from './text';

export type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Label for the dimmed backdrop, which closes the sheet when tapped. */
  closeLabel: string;
};

/** Bottom sheet for confirmations (e.g. joining a challenge). Slides in, no shadows. */
export function Sheet({ visible, title, onClose, children, closeLabel }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
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
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
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
  handle: {
    alignSelf: 'center',
    width: spacing.xl,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
});
