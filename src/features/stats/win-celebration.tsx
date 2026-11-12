import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, motion, radius, spacing } from '@/theme';

import { useMyWins, type Win } from './api';
import {
  loadCelebrationState,
  nextUnseenWin,
  saveCelebrationState,
  type CelebrationState,
} from './celebration-storage';

const CONFETTI_COUNT = 14;
const CONFETTI_DISTANCE = 150;
const BADGE_SIZE = 112;

/**
 * Shows a full-screen celebration the next time the app is open after a challenge was
 * won – once per win. The amount is the payout the server booked.
 */
export function WinCelebration() {
  const userId = useSession().user.id;
  const wins = useMyWins(userId);
  const [state, setState] = useState<CelebrationState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCelebrationState(userId, new Date()).then((loaded) => {
      if (!cancelled) {
        setState(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const win = state && wins.data ? nextUnseenWin(wins.data, state) : undefined;

  const dismiss = useCallback(() => {
    if (!state || !win) {
      return;
    }
    const next = { ...state, seen: [...state.seen, win.challengeId] };
    setState(next);
    void saveCelebrationState(userId, next).catch(() => undefined);
  }, [state, userId, win]);

  if (!win) {
    return null;
  }
  return <CelebrationModal key={win.challengeId} win={win} onClose={dismiss} />;
}

function CelebrationModal({ win, onClose }: { win: Win; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (cancelled) {
        return;
      }
      if (enabled) {
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

  const bonusCents = win.payoutCents - win.stakeCents;
  const amount = formatAmount(win.payoutCents);
  const badgeScale = progress.interpolate({
    inputRange: [0, 0.5, 0.75, 1],
    outputRange: [0, 1.2, 0.95, 1],
  });
  const textOpacity = progress.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1] });
  const textShift = progress.interpolate({ inputRange: [0.4, 1], outputRange: [spacing.md, 0] });
  const confettiOpacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}
        accessibilityViewIsModal
      >
        <View style={styles.center}>
          <View style={styles.stage}>
            {Array.from({ length: CONFETTI_COUNT }, (_, index) => {
              const angle = (index / CONFETTI_COUNT) * 2 * Math.PI;
              const distance = progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, CONFETTI_DISTANCE * (index % 2 === 0 ? 1 : 0.7)],
              });
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.confetti,
                    index % 3 === 0 && styles.confettiLarge,
                    {
                      opacity: confettiOpacity,
                      transform: [
                        { translateX: Animated.multiply(distance, Math.cos(angle)) },
                        { translateY: Animated.multiply(distance, Math.sin(angle)) },
                      ],
                    },
                  ]}
                />
              );
            })}
            <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
              <Icon name="trophy" color="onAccent" size={BADGE_SIZE / 2} />
            </Animated.View>
          </View>

          <Animated.View
            style={[styles.texts, { opacity: textOpacity, transform: [{ translateY: textShift }] }]}
            accessible
            accessibilityLabel={de.celebration.accessibility(win.title, amount)}
          >
            <Text variant="label" color="accent" align="center">
              {de.celebration.title}
            </Text>
            <Text variant="display" align="center" numberOfLines={1} adjustsFontSizeToFit>
              {`+${amount}`}
            </Text>
            <Text variant="heading" color="textSecondary" align="center">
              {de.common.credits}
            </Text>
            <Text align="center">{win.title}</Text>
            <Text color="textSecondary" align="center">
              {bonusCents > 0
                ? de.celebration.withBonus(formatAmount(bonusCents))
                : de.celebration.stakeBack}
            </Text>
          </Animated.View>
        </View>
        <Button label={de.celebration.close} onPress={onClose} />
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
  stage: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  confetti: {
    position: 'absolute',
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  confettiLarge: {
    width: spacing.sm,
    height: spacing.sm,
    backgroundColor: colors.text,
  },
  texts: {
    alignItems: 'stretch',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
});
