import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, useAnimatedValue, View } from 'react-native';
import { z } from 'zod';

import { Card, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { challengeDays, isGoalType } from '@/features/challenges/format';
import { useMyDailySteps, useMyProgress, useRecentWorkouts } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { progressRatio } from '@/features/health/progress';
import { useMotionEnabled } from '@/features/preferences/motion';
import { de } from '@/i18n/de';
import { addDays, toLocalDate } from '@/lib/dates';
import { secureStorage } from '@/lib/secure-storage';
import { colors, spacing } from '@/theme';
import { Mascot } from './mascot';
import { coachStage } from './model';

const memorySchema = z.object({
  days: z.array(z.string()),
  startedDay: z.string().optional(),
  progress: z.record(z.string(), z.number()),
  ended: z.array(z.string()),
  steps: z.record(z.string(), z.number()).default({}),
});
export function Coach() {
  const session = useSession();
  const uid = session.user.id;
  const profile = useMyProfile(uid);
  const health = useHealth();
  const today = toLocalDate(new Date(), profile.data?.timezone ?? DEFAULT_TIMEZONE);
  const days = useMyDailySteps(uid, addDays(today, -44), today, true);
  const workouts = useRecentWorkouts(uid);
  const challenges = useMyChallenges(uid);
  const progress = useMyProgress(uid);
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState<string>(de.coach.ongoing);
  const [visit, setVisit] = useState(0);
  const handled = useRef(-1);
  const motionOn = useMotionEnabled();
  const bounce = useAnimatedValue(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setVisit((v) => v + 1);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (
      health.syncing ||
      !days.data ||
      !challenges.data ||
      !progress.data ||
      handled.current === visit
    )
      return;
    let cancelled = false;
    void (async () => {
      const key = 'push.coach.' + uid;
      const raw = await secureStorage.getItem(key);
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {}
      const saved = memorySchema.safeParse(parsed);
      const old = saved.success ? saved.data : { days: [], progress: {}, ended: [], steps: {} };
      const startedDay = old.startedDay ?? today;
      const activeDays = [
        ...new Set([
          ...old.days,
          ...days.data!.filter((d) => d.isValid && d.steps > 0).map((d) => d.date),
          ...(workouts.data ?? [])
            .filter((w) => w.isValid)
            .map((w) =>
              toLocalDate(new Date(w.startAt), profile.data?.timezone ?? DEFAULT_TIMEZONE),
            ),
        ]),
      ];
      let text: string = de.coach.ongoing;
      const ended = [...old.ended];
      const stepSnapshot = Object.fromEntries(
        days.data!.filter((d) => d.isValid).map((d) => [d.date, d.steps]),
      );
      const stepDelta = Object.entries(stepSnapshot).reduce(
        (total, [date, value]) => total + Math.max(0, value - (old.steps[date] ?? value)),
        0,
      );
      if (stepDelta > 0)
        text =
          de.coach.more + ' ' + stepDelta.toLocaleString('de-DE') + ' ' + de.progress.unitSteps;
      for (const c of challenges.data!) {
        if (!c.isParticipant || c.mode === 'ranked' || !isGoalType(c.goal_type)) continue;
        const value = progress.data![c.id] ?? 0;
        const ratio = progressRatio(c.goal_type, value, c.target_value, challengeDays(c).days);
        if ((ratio >= 1 || Date.parse(c.ends_at) <= Date.now()) && !old.ended.includes(c.id)) {
          text = ratio >= 1 ? de.coach.won : de.coach.missed;
          ended.push(c.id);
          break;
        }
        const delta = value - (old.progress[c.id] ?? value);
        if (delta > 0) {
          const number = c.goal_type.startsWith('run')
            ? (delta / 1000).toLocaleString('de-DE') + ' km'
            : delta.toLocaleString('de-DE') +
              ' ' +
              (c.goal_type === 'steps_daily' ? de.progress.unitDays : de.progress.unitSteps);
          text = de.coach.more + ' ' + number;
        }
      }
      if (cancelled) return;
      handled.current = visit;
      setStage(coachStage(activeDays.filter((day) => day >= startedDay).length));
      setMessage(text);
      await secureStorage.setItem(
        key,
        JSON.stringify({
          days: activeDays.filter((day) => day >= startedDay),
          startedDay,
          progress: progress.data,
          ended,
          steps: stepSnapshot,
        }),
      );
    })().catch(() => {
      if (!cancelled) setMessage(de.coach.ongoing);
    });
    return () => {
      cancelled = true;
    };
  }, [
    uid,
    visit,
    days.data,
    challenges.data,
    progress.data,
    health.syncing,
    workouts.data,
    profile.data?.timezone,
    today,
  ]);
  useEffect(() => {
    if (!motionOn) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -4,
          duration: 1250,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 1250,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      bounce.setValue(0);
    };
  }, [motionOn, bounce]);

  return (
    <Card style={styles.card}>
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ transform: [{ translateY: bounce }] }}
      >
        <Mascot stage={stage} dizzy={false} gaze={0} />
      </Animated.View>
      <View style={styles.copy}>
        <Text variant="heading">{de.coach.name}</Text>
        <Text variant="caption" color="textSecondary">
          {message}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
  },
  copy: { flex: 1, gap: spacing.xs },
});
