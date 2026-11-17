import { useCallback, useEffect, useState } from 'react';
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

import { Button, Confetti, EditorialHero, Text } from '@/components';
import { BadgeCelebration } from '@/features/badges/badge-celebration';
import { useSession } from '@/features/auth/auth-provider';
import { ShareButton } from '@/features/share/share-button';
import { maybeAskForReview } from '@/features/review/review';
import { hapticSuccess } from '@/features/preferences/haptics';
import { FurNumber } from '@/features/fur/fur-number';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, motion, spacing } from '@/theme';

import { useMyWins, type Win } from './api';
import {
  loadCelebrationState,
  nextUnseenWin,
  saveCelebrationState,
  type CelebrationState,
} from './celebration-storage';

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
    // A good moment, and only if the rules allow it (rare, never in the first days).
    void maybeAskForReview('win');
  }, [state, userId, win]);

  if (!win) {
    // Badges wait until no win celebration is on screen.
    return <BadgeCelebration />;
  }
  return <CelebrationModal key={win.challengeId} win={win} onClose={dismiss} />;
}

function CelebrationModal({ win, onClose }: { win: Win; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    hapticSuccess();
  }, []);
  const progress = useAnimatedValue(0);

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

  const amount = formatAmount(win.payoutCents);
  const textOpacity = progress.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1] });
  const textShift = progress.interpolate({ inputRange: [0.4, 1], outputRange: [spacing.md, 0] });

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}
        accessibilityViewIsModal
      >
        <Confetti />
        <EditorialHero
          word={de.celebration.word}
          label={win.title.toUpperCase()}
          pose="cheer"
          inset={spacing.md}
        />
        <View style={styles.center}>
          <Animated.View
            style={[styles.texts, { opacity: textOpacity, transform: [{ translateY: textShift }] }]}
            accessible
            accessibilityLabel={de.celebration.accessibility(win.title, amount)}
          >
            <FurNumber value={amount} height={72} maxWidth={260} label={`+${amount}`} />
            <Text variant="heading" color="textSecondary" align="center">
              {de.common.credits}
            </Text>
            <Text align="center">{win.title}</Text>
            <Text color="textSecondary" align="center">
              {de.celebration.stakeBack}
            </Text>
          </Animated.View>
        </View>
        <View style={styles.shareRow}>
          <ShareButton
            data={{
              label: de.share.winLabel,
              headline: `+${amount}`,
              subline: `${de.share.creditsLine} · ${win.title}`,
              facts: [],
            }}
          />
        </View>
        <Button label={de.celebration.close} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shareRow: {
    marginBottom: spacing.sm,
  },
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
  texts: {
    alignItems: 'stretch',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
});
