import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar, Text } from '@/components';
import { APP_NAME } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { useMyProgress } from '@/features/health/api';
import { pickPrimaryChallenge, progressRatio } from '@/features/health/progress';
import { useClock } from '@/features/gps/use-clock';
import { useMyChallenges } from './api';
import { challengeDays, isGoalType } from './format';
import { colors, spacing } from '@/theme';
import { de } from '@/i18n/de';
export function GoalHeader() {
  const { user } = useSession();
  const goals = useMyChallenges(user.id);
  const progress = useMyProgress(user.id);
  const now = useClock(true);
  const goal = pickPrimaryChallenge(
    (goals.data ?? []).filter(
      (g) => g.isParticipant && Date.parse(g.starts_at) <= now && Date.parse(g.ends_at) > now,
    ),
  );
  const ratio =
    goal && isGoalType(goal.goal_type)
      ? progressRatio(
          goal.goal_type,
          progress.data?.[goal.id] ?? 0,
          goal.target_value,
          challengeDays(goal).days,
        )
      : 0;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.row}>
        <Text variant="heading">{APP_NAME}</Text>
        <Text variant="caption" numberOfLines={1}>
          {goal ? goal.title : de.coach.hello}
        </Text>
      </View>
      {goal ? (
        <ProgressBar
          progress={ratio}
          accessibilityLabel={de.coach.progress + ' ' + Math.round(ratio * 100) + '%'}
        />
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
