import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components';
import { QUICK_GOALS } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { hasRunGoal } from '@/features/challenges/run-goal';
import { hapticTap } from '@/features/preferences/haptics';
import { PledgeSheet } from '@/features/pledge/pledge-sheet';
import {
  quickGoalScopeLabel,
  quickGoalTarget,
  type QuickGoal,
} from '@/features/pledge/quick-goals';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

const RUN_GOALS = QUICK_GOALS.filter((goal) => goal.goalType.startsWith('run'));

/**
 * A run only counts for a goal, so every "Lauf starten" asks for one first. `requestRun`
 * calls `onAllowed` when a run goal exists; otherwise it opens a hint with the goal choice and
 * the pledge sheet. Render `gate` once next to the button.
 */
export function useRunGate(onAllowed: () => void): {
  requestRun: () => void;
  gate: ReactElement;
} {
  const router = useRouter();
  const userId = useSession().user.id;
  const mine = useMyChallenges(userId);
  const [hint, setHint] = useState(false);
  const [selected, setSelected] = useState<QuickGoal['id']>(RUN_GOALS[0].id);
  const [picked, setPicked] = useState<QuickGoal | null>(null);

  const requestRun = () => {
    if (mine.data && !hasRunGoal(mine.data, Date.now())) {
      setHint(true);
      return;
    }
    onAllowed();
  };

  const gate = (
    <>
      <Sheet
        visible={hint}
        title={de.runGate.title}
        onClose={() => setHint(false)}
        closeLabel={de.common.close}
      >
        <Text color="textSecondary">{de.runGate.text}</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {RUN_GOALS.map((goal) => {
            const active = goal.id === selected;
            return (
              <Pressable
                key={goal.id}
                accessibilityRole="radio"
                accessibilityLabel={de.pledge.chipLabel(
                  quickGoalTarget(goal),
                  quickGoalScopeLabel(goal),
                )}
                accessibilityState={{ checked: active }}
                onPress={() => {
                  hapticTap();
                  setSelected(goal.id);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text variant="caption" color={active ? 'accent' : 'text'} align="center">
                  {quickGoalTarget(goal)}
                </Text>
                <Text variant="label" color="textSecondary" align="center" numberOfLines={1}>
                  {quickGoalScopeLabel(goal)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          label={de.pledge.setGoal}
          onPress={() => {
            setHint(false);
            setPicked(RUN_GOALS.find((goal) => goal.id === selected) ?? null);
          }}
        />
        <Button
          label={de.pledge.custom}
          variant="secondary"
          onPress={() => {
            setHint(false);
            router.push('/challenge/create');
          }}
        />
      </Sheet>
      <PledgeSheet key={picked?.id ?? 'none'} goal={picked} onClose={() => setPicked(null)} />
    </>
  );

  return { requestRun, gate };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    minHeight: layout.minTouchTarget + spacing.md,
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.card,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent },
});
