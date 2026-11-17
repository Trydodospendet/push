import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Confetti, Text } from '@/components';
import { Pushy } from '@/features/coach/pushy';
import { BadgeCelebration } from '@/features/badges/badge-celebration';
import { useSession } from '@/features/auth/auth-provider';
import { ShareButton } from '@/features/share/share-button';
import { maybeAskForReview } from '@/features/review/review';
import { hapticSuccess } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, fontFamily, layout, spacing } from '@/theme';

import { useMyStats, useMyWins, type Win } from './api';
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

const PUSHY_SCALE = 2.4;

function CelebrationModal({ win, onClose }: { win: Win; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const stats = useMyStats(useSession().user.id);

  useEffect(() => {
    hapticSuccess();
  }, []);

  const amount = formatAmount(win.payoutCents);
  const streak = stats.data?.streakDays ?? 0;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}
        accessibilityViewIsModal
      >
        <Confetti />
        <Text style={styles.word} accessibilityElementsHidden importantForAccessibility="no">
          {de.celebration.word}
        </Text>
        <View
          style={styles.center}
          accessible
          accessibilityLabel={de.celebration.accessibility(win.title, amount)}
        >
          <Text variant="label" color="accent" align="center">
            {de.celebration.label}
          </Text>
          <Pushy pose="cheer" scale={PUSHY_SCALE} />
          <Text variant="title" align="center">
            {win.title}
          </Text>
        </View>
        <View style={styles.cards}>
          <Card style={styles.cardRow}>
            <View style={styles.cardText}>
              <Text variant="label" color="textSecondary">
                {de.celebration.pledge}
              </Text>
              <Text>{de.celebration.stakeBack}</Text>
            </View>
            <Text variant="title" color="accent">
              {amount}
            </Text>
          </Card>
          {streak > 0 ? (
            <Card style={styles.cardRow}>
              <Text>{de.celebration.streak}</Text>
              <Text variant="heading">{de.stats.streak(streak)}</Text>
            </Card>
          ) : null}
        </View>
        <View style={styles.actions}>
          <ShareButton
            variant="primary"
            data={{
              label: de.share.winLabel,
              headline: `+${amount}`,
              subline: `${de.share.creditsLine} · ${win.title}`,
              facts: [],
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={de.celebration.close}
            onPress={onClose}
            style={styles.close}
          >
            <Text color="textSecondary" align="center">
              {de.celebration.close}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: layout.screenPadding,
  },
  word: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamily.extraBold,
    fontSize: 74,
    letterSpacing: -3,
    color: colors.text,
    opacity: 0.08,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cards: { gap: spacing.xs, marginBottom: spacing.lg },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardText: { gap: spacing.xxs, flexShrink: 1 },
  actions: { gap: spacing.xs },
  close: { minHeight: 48, justifyContent: 'center' },
});
