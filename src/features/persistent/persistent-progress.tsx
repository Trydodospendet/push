import { useEffect } from 'react';

import { useSession } from '@/features/auth/auth-provider';
import { useMyProfile } from '@/features/auth/api';
import { useMyChallenges } from '@/features/challenges/api';
import { isGoalType } from '@/features/challenges/format';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { measureTrack } from '@/features/gps/geo';
import { useGps } from '@/features/gps/gps-provider';
import { useClock } from '@/features/gps/use-clock';
import { useMyDailySteps, useMyProgress } from '@/features/health/api';
import { pickPrimaryChallenge } from '@/features/health/progress';
import { usePreferences } from '@/features/preferences/store';
import { toLocalDate } from '@/lib/dates';

import { clearProgress, persistentSupported, showProgress } from './notification';
import { goalText, runText } from './text';

/**
 * Keeps the permanent progress notification (Android) up to date: when the app opens, after
 * every sync (the data queries refresh) and while a run is recorded. Renders nothing.
 */
export function PersistentProgress() {
  const { persistentProgress } = usePreferences();
  const { user } = useSession();
  const uid = user.id;
  const profile = useMyProfile(uid);
  const today = toLocalDate(new Date(), profile.data?.timezone ?? DEFAULT_TIMEZONE);
  const challenges = useMyChallenges(uid);
  const progress = useMyProgress(uid);
  const steps = useMyDailySteps(uid, today, today, persistentProgress);
  const { recorder } = useGps();

  const running = recorder.status === 'recording' || recorder.status === 'paused';
  const runMeters = running ? Math.round(measureTrack(recorder.points).distanceM / 10) * 10 : 0;

  const now = useClock(true);
  const goal = pickPrimaryChallenge(
    (challenges.data ?? []).filter(
      (g) => g.isParticipant && Date.parse(g.starts_at) <= now && Date.parse(g.ends_at) > now,
    ),
  );
  const stepsToday = steps.data?.find((d) => d.date === today && d.isValid)?.steps ?? 0;
  const progressValue = goal ? (progress.data?.[goal.id] ?? 0) : 0;

  let text: string | null = null;
  if (running) {
    text = runText(runMeters);
  } else if (goal && isGoalType(goal.goal_type)) {
    text = goalText({
      goalType: goal.goal_type,
      targetValue: goal.target_value,
      progress: progressValue,
      stepsToday,
    });
  }

  useEffect(() => {
    if (!persistentSupported) return;
    if (!persistentProgress || text === null) {
      void clearProgress().catch(() => undefined);
      return;
    }
    void showProgress(text).catch(() => undefined);
  }, [persistentProgress, text]);

  useEffect(
    () => () => {
      void clearProgress().catch(() => undefined);
    },
    [],
  );

  return null;
}
