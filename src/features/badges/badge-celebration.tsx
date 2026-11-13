import { useEffect } from 'react';
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
import { useSession } from '@/features/auth/auth-provider';
import { de } from '@/i18n/de';
import { colors, motion, radius, spacing } from '@/theme';

import { useMarkBadgeSeen, useMyBadges } from './api';
import { BADGE_ICONS, type BadgeCode } from './catalog';

const BADGE_SIZE = 112;

/** Short celebration for the oldest badge the user has not seen yet; one at a time. */
export function BadgeCelebration() {
  const userId = useSession().user.id;
  const badges = useMyBadges(userId);
  const markSeen = useMarkBadgeSeen(userId);
  const next = badges.data?.find((badge) => !badge.seen);

  if (!next) {
    return null;
  }
  return (
    <BadgeModal
      key={next.code}
      code={next.code}
      onClose={() => {
        if (!markSeen.isPending) {
          markSeen.mutate(next.code);
        }
      }}
    />
  );
}

function BadgeModal({ code, onClose }: { code: BadgeCode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useAnimatedValue(0);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) {
        return;
      }
      if (reduce) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.celebrationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
      progress.stopAnimation();
    };
  }, [progress]);

  const scale = progress.interpolate({
    inputRange: [0, 0.5, 0.75, 1],
    outputRange: [0, 1.2, 0.95, 1],
  });
  const textOpacity = progress.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1] });
  const copy = de.badges.items[code];

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}
        accessibilityViewIsModal
      >
        <View style={styles.center}>
          <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
            <Icon name={BADGE_ICONS[code]} color="onAccent" size={BADGE_SIZE / 2} />
          </Animated.View>
          <Animated.View
            style={[styles.texts, { opacity: textOpacity }]}
            accessible
            accessibilityLabel={de.badges.accessibility(copy.title, copy.description)}
          >
            <Text variant="label" color="accent" align="center">
              {de.badges.newBadge}
            </Text>
            <Text variant="title" align="center">
              {copy.title}
            </Text>
            <Text color="textSecondary" align="center">
              {copy.description}
            </Text>
          </Animated.View>
        </View>
        <Button label={de.badges.close} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  texts: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
});
