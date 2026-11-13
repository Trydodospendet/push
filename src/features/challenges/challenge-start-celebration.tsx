import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  useAnimatedValue,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { hapticSuccess } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { colors, motion, radius, spacing } from '@/theme';

export function ChallengeStartCelebration({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useAnimatedValue(0);
  const [quote] = useState<string>(() => {
    const quotes = de.challengeStart.quotes;
    return quotes[Math.floor(Math.random() * quotes.length)] ?? quotes[0];
  });

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    hapticSuccess();

    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) {
        return;
      }
      if (reduceMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.celebrationMs,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      cancelled = true;
      progress.stopAnimation();
    };
  }, [progress, visible]);

  if (!visible) {
    return null;
  }

  const badgeScale = progress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.35, 1.08, 1],
  });
  const textOpacity = progress.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1] });
  const textShift = progress.interpolate({ inputRange: [0.3, 1], outputRange: [spacing.md, 0] });

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}
        accessibilityViewIsModal
      >
        <View style={styles.center}>
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            <Icon name="rocket" color="onAccent" size={48} />
          </Animated.View>
          <Animated.View
            style={[styles.copy, { opacity: textOpacity, transform: [{ translateY: textShift }] }]}
            accessible
            accessibilityLabel={`${de.challengeStart.title}. ${quote}`}
          >
            <Text variant="title" align="center" accessibilityRole="header">
              {de.challengeStart.title}
            </Text>
            <Text color="textSecondary" align="center">
              {de.challengeStart.subtitle}
            </Text>
            <Text variant="heading" color="accent" align="center">
              {`„${quote}“`}
            </Text>
          </Animated.View>
        </View>
        <Button label={de.challengeStart.close} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  badge: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  copy: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.md,
  },
});
