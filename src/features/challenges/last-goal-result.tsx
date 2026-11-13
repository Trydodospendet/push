import { useClock } from '@/features/gps/use-clock';
import { useRouter } from 'expo-router';
import { Button, Card, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyProgress } from '@/features/health/api';
import { progressRatio } from '@/features/health/progress';
import { useMyChallenges } from './api';
import { challengeDays, isGoalType } from './format';
import { de } from '@/i18n/de';
export function LastGoalResult() {
  const now = useClock(true);
  const { user } = useSession();
  const router = useRouter();
  const goals = useMyChallenges(user.id);
  const progress = useMyProgress(user.id);
  const goal = goals.data
    ?.filter(
      (c) =>
        c.isParticipant &&
        c.mode !== 'ranked' &&
        c.status !== 'cancelled' &&
        Date.parse(c.ends_at) <= now,
    )
    .sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0];
  if (!goal || !progress.data || !isGoalType(goal.goal_type)) return null;
  const won =
    progressRatio(
      goal.goal_type,
      progress.data[goal.id] ?? 0,
      goal.target_value,
      challengeDays(goal).days,
    ) >= 1;
  return (
    <Card raised>
      <Text variant="heading">{goal.title}</Text>
      <Text color={won ? 'accent' : 'textSecondary'}>{won ? de.coach.won : de.coach.missed}</Text>
      <Button
        label={de.challenge.result}
        variant="secondary"
        onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: goal.id } })}
      />
    </Card>
  );
}
