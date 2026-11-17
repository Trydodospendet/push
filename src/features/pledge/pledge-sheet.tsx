import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useAnimatedValue, View } from 'react-native';

import { HoldButton, Sheet, Text } from '@/components';
import {
  DEFAULT_PLEDGE_CENTS,
  DEFAULT_TIMEZONE,
  PLEDGE_STEP_CENTS,
  REAL_MONEY_MAX_DAYS,
  STAKE_MAX_CENTS,
  STAKE_MIN_CENTS,
} from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useCreateGoal } from '@/features/challenges/api';
import { useNgos } from '@/features/donations/api';
import { PaymentCancelledError, useRealMoneyStatus, useReserveGoal } from '@/features/payments/api';
import { createGoalSchema } from '@/features/challenges/schemas';
import { hapticError, hapticSelect } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { playSound } from '@/features/preferences/sounds';
import { useWalletBalance } from '@/features/wallet/api';
import { de } from '@/i18n/de';
import { addDays, toLocalDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { colors, layout, radius, spacing } from '@/theme';

import {
  quickGoalDates,
  quickGoalScopeLabel,
  quickGoalTarget,
  quickGoalTitle,
  type QuickGoal,
} from './quick-goals';

/** 500 → '5', 550 → '5,50': whole credits without decimals, as on the buttons. */
export function formatPledge(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : formatAmount(cents);
}

function RoundButton({
  label,
  glyph,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const motionEnabled = useMotionEnabled();
  const scale = useAnimatedValue(1);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          if (motionEnabled) {
            Animated.spring(scale, { toValue: 0.88, useNativeDriver: true }).start();
          }
        }}
        onPressOut={() => {
          if (motionEnabled) {
            Animated.spring(scale, {
              toValue: 1,
              friction: 3,
              tension: 180,
              useNativeDriver: true,
            }).start();
          }
        }}
        onPress={() => {
          hapticSelect();
          playSound('tick');
          onPress();
        }}
        style={[styles.round, disabled && styles.roundDisabled]}
      >
        <Text variant="title" color={disabled ? 'textMuted' : 'accent'} align="center">
          {glyph}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Second step of the two-step flow: choose the pledge with +/- (default 5) and set it by holding
 * the button. Creates the goal in one server call; the pledge is booked right away.
 */
export function PledgeSheet({ goal, onClose }: { goal: QuickGoal | null; onClose: () => void }) {
  const router = useRouter();
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const balance = useWalletBalance(session.user.id);
  const create = useCreateGoal();
  const reserve = useReserveGoal(session.user.id);
  const realMoney = useRealMoneyStatus(session.user.id).data === true;
  const ngos = useNgos();
  const busy = create.isPending || reserve.isPending;
  const motionEnabled = useMotionEnabled();
  const [pledge, setPledge] = useState<number>(DEFAULT_PLEDGE_CENTS);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pop = useAnimatedValue(1);
  const submitting = useRef(false);

  const open = goal !== null;

  const max =
    realMoney || balance.data === undefined
      ? STAKE_MAX_CENTS
      : Math.max(STAKE_MIN_CENTS, Math.min(STAKE_MAX_CENTS, balance.data));

  const change = (delta: number) => {
    setPledge((value) => Math.max(STAKE_MIN_CENTS, Math.min(max, value + delta)));
    setError(null);
    if (motionEnabled) {
      pop.setValue(1.18);
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const confirm = () => {
    if (!goal || submitting.current) {
      return;
    }
    if (!realMoney && balance.data !== undefined && pledge > balance.data) {
      hapticError();
      setError(de.serverErrors.insufficient_funds);
      return;
    }
    const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;
    const dates = quickGoalDates(toLocalDate(new Date(), timezone), goal.scope);
    const parsed = createGoalSchema.safeParse({
      title: quickGoalTitle(goal),
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      stakeCents: pledge,
      period: goal.scope === 'today' ? 'day' : 'week',
      startDate: dates.first,
      endDate: dates.last,
      withFriends: false,
      donate: true,
      ngoId: profile.data?.default_ngo_id ?? null,
    });
    if (!parsed.success) {
      setError(de.pledge.noNetwork);
      return;
    }
    if (realMoney && dates.last > addDays(dates.first, REAL_MONEY_MAX_DAYS - 1)) {
      hapticError();
      setError(de.payments.tooLong);
      return;
    }
    submitting.current = true;
    setError(null);
    if (realMoney) {
      reserve.mutate(parsed.data, {
        onSuccess: (challengeId) => {
          onClose();
          router.replace({
            pathname: '/challenge/[id]',
            params: { id: challengeId, started: '1' },
          });
        },
        onError: (mutationError) => {
          if (mutationError instanceof PaymentCancelledError) {
            return;
          }
          hapticError();
          setError(de.payments.failed);
        },
        onSettled: () => {
          submitting.current = false;
        },
      });
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (challenge) => {
        onClose();
        router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id, started: '1' } });
      },
      onError: (mutationError) => {
        hapticError();
        setError(toUserMessage(mutationError));
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  const amount = formatPledge(pledge);
  const ngoName =
    ngos.data?.find((ngo) => ngo.id === profile.data?.default_ngo_id)?.name ??
    ngos.data?.[0]?.name ??
    de.payments.ngoFallback;
  return (
    <Sheet
      visible={open}
      title={de.pledge.sheetTitle}
      onClose={busy ? () => undefined : onClose}
      closeLabel={de.joinSheet.cancel}
    >
      {goal ? (
        <>
          <Text variant="heading" align="center">
            {de.pledge.cardLabel(quickGoalTarget(goal), quickGoalScopeLabel(goal))}
          </Text>
          <View style={styles.stepper}>
            <RoundButton
              label={de.pledge.less}
              glyph="−"
              disabled={pledge <= STAKE_MIN_CENTS || busy}
              onPress={() => change(-PLEDGE_STEP_CENTS)}
            />
            <Animated.View
              style={[styles.amount, { transform: [{ scale: pop }] }]}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={de.pledge.amount(amount)}
              accessibilityValue={{ text: de.pledge.amount(amount) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) =>
                change(
                  event.nativeEvent.actionName === 'increment'
                    ? PLEDGE_STEP_CENTS
                    : -PLEDGE_STEP_CENTS,
                )
              }
            >
              <Text variant="display" color="accent" align="center" style={styles.number}>
                {amount}
              </Text>
              <Text variant="caption" color="textSecondary" align="center">
                {realMoney ? de.payments.unit : de.pledge.unit}
              </Text>
            </Animated.View>
            <RoundButton
              label={de.pledge.more}
              glyph="+"
              disabled={pledge >= max || busy}
              onPress={() => change(PLEDGE_STEP_CENTS)}
            />
          </View>
          <Text color="textSecondary" align="center">
            {realMoney ? de.payments.reserveNotice(amount, ngoName) : de.pledge.oneLine}
          </Text>
          <HoldButton
            label={de.pledge.set(amount)}
            holdingLabel={de.pledge.holding}
            accessibilityHint={de.pledge.holdHint}
            loading={busy}
            onComplete={confirm}
          />
          {error ? (
            <Text color="danger" align="center" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {!realMoney && balance.data !== undefined ? (
            <Text variant="caption" color="textMuted" align="center">
              {de.pledge.balance(formatAmount(balance.data))}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={details ? de.pledge.detailsHide : de.pledge.detailsShow}
            onPress={() => setDetails((value) => !value)}
            style={styles.moreLink}
          >
            <Text color="textSecondary" align="center">
              {details ? de.pledge.detailsHide : de.pledge.detailsShow}
            </Text>
          </Pressable>
          {details ? (
            <View style={styles.details}>
              {de.pledge.details.map((line) => (
                <Text key={line} variant="caption" color="textSecondary">
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
          {realMoney ? null : (
            <Text variant="caption" color="textMuted" align="center">
              {de.common.virtualCreditsNotice}
            </Text>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  round: {
    width: layout.buttonHeight,
    height: layout.buttonHeight,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDisabled: {
    borderColor: colors.border,
  },
  amount: {
    flex: 1,
    alignItems: 'center',
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
  moreLink: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  details: {
    gap: spacing.xs,
  },
});
