import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, useAnimatedValue, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components';
import { QUICK_GOALS } from '@/config/app';
import { hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { playSound } from '@/features/preferences/sounds';
import { de } from '@/i18n/de';
import { colors, layout, spacing } from '@/theme';

import { PledgeSheet } from './pledge-sheet';
import { quickGoalScopeLabel, quickGoalTarget, type QuickGoal } from './quick-goals';

function QuickGoalCard({ goal, onPick }: { goal: QuickGoal; onPick: (goal: QuickGoal) => void }) {
  const motionEnabled = useMotionEnabled();
  const scale = useAnimatedValue(1);
  const target = quickGoalTarget(goal);
  const scope = quickGoalScopeLabel(goal);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de.pledge.cardLabel(target, scope)}
        accessibilityHint={de.pledge.cardHint}
        onPressIn={() => {
          if (motionEnabled) {
            Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
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
          hapticTap();
          playSound('pop');
          onPick(goal);
        }}
      >
        <Card style={styles.card}>
          <View style={styles.text}>
            <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
              {target}
            </Text>
            <Text color="textSecondary" numberOfLines={1}>
              {scope}
            </Text>
          </View>
          <Icon name="chevron-forward" color="accent" />
        </Card>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Step 1 of the pledge flow: three big suggestions and "Eigenes Ziel". A tap opens the pledge
 * sheet (step 2). The long form stays behind "Eigenes Ziel".
 */
export function QuickGoalCards() {
  const router = useRouter();
  const [picked, setPicked] = useState<QuickGoal | null>(null);

  return (
    <View style={styles.root}>
      {QUICK_GOALS.map((goal) => (
        <QuickGoalCard key={goal.id} goal={goal} onPick={setPicked} />
      ))}
      <Button
        label={de.pledge.custom}
        variant="secondary"
        accessibilityHint={de.pledge.customHint}
        onPress={() => router.push('/challenge/create')}
      />
      <PledgeSheet key={picked?.id ?? 'none'} goal={picked} onClose={() => setPicked(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  card: {
    minHeight: layout.buttonHeight + spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderColor: colors.border,
  },
  text: {
    flex: 1,
  },
});
