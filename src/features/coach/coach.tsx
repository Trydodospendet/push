import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, StyleSheet, useAnimatedValue, View } from 'react-native';
import { z } from 'zod';
import { Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyProfile } from '@/features/auth/api';
import { useMyChallenges } from '@/features/challenges/api';
import { challengeDays, isGoalType } from '@/features/challenges/format';
import { useMyDailySteps, useMyProgress, useRecentWorkouts } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { progressRatio } from '@/features/health/progress';
import { useGps } from '@/features/gps/gps-provider';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { addDays, toLocalDate } from '@/lib/dates';
import { secureStorage } from '@/lib/secure-storage';
import { de } from '@/i18n/de';
import { layout, spacing } from '@/theme';
import { coachStage, isNight } from './model';
import type { PushyPose } from '@/features/fur/images';
import { hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
import { usePreferences } from '@/features/preferences/store';
import { playSound } from '@/features/preferences/sounds';
import { Pushy } from './pushy';
const IDLE_MS = 5 * 60 * 1000;
const WAVE_MS = 1400;
const memorySchema = z.object({
  days: z.array(z.string()),
  startedDay: z.string().optional(),
  progress: z.record(z.string(), z.number()),
  ended: z.array(z.string()),
  steps: z.record(z.string(), z.number()).default({}),
});
/**
 * Pushy sits in its own spot at the right edge of the header, so it never covers content. Its
 * short messages appear next to it (`fallback` when there is none). Tapping puts it to sleep
 * and wakes it up again.
 */
export function Coach({ fallback }: { fallback: string }) {
  const { pushy: visible } = usePreferences();
  const session = useSession();
  const uid = session.user.id;
  const profile = useMyProfile(uid);
  const health = useHealth();
  const today = toLocalDate(new Date(), profile.data?.timezone ?? DEFAULT_TIMEZONE);
  const days = useMyDailySteps(uid, addDays(today, -44), today, true);
  const workouts = useRecentWorkouts(uid);
  const challenges = useMyChallenges(uid);
  const progress = useMyProgress(uid);
  const { recorder } = useGps();
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [visit, setVisit] = useState(0);
  const handled = useRef(-1);
  const lastQuote = useRef(-1);
  const motionOn = useMotionEnabled();
  const bounce = useAnimatedValue(0);
  const hop = useAnimatedValue(0);
  const pokes = useRef(0);
  const [mood, setMood] = useState<'won' | 'missed' | null>(null);
  const [waving, setWaving] = useState(false);
  const [asleep, setAsleep] = useState(() => isNight(new Date().getHours()));
  const [activity, setActivity] = useState(0);
  const wasNight = useRef(isNight(new Date().getHours()));
  const recording = recorder.status === 'recording';

  /** A tap: sleeping Pushy wakes up, awake Pushy falls asleep. */
  const toggleSleep = () => {
    hapticTap();
    playSound('pop');
    setActivity((value) => value + 1);
    if (asleep) {
      setAsleep(false);
      setWaving(true);
      pokes.current += 1;
      setMessage(de.coach.pokes[pokes.current % de.coach.pokes.length]);
      if (!motionOn) return;
      hop.setValue(0);
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 130, useNativeDriver: true }),
        Animated.timing(hop, { toValue: 2, duration: 170, useNativeDriver: true }),
      ]).start();
    } else {
      setWaving(false);
      setMessage(null);
      setAsleep(true);
    }
  };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setVisit((v) => v + 1);
        setActivity((value) => value + 1);
      }
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
      setMood(text === de.coach.won ? 'won' : text === de.coach.missed ? 'missed' : null);
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
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage(null);
      setMood(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || asleep) return;
      const next = (lastQuote.current + 1) % de.challengeStart.quotes.length;
      lastQuote.current = next;
      setMessage(de.challengeStart.quotes[next]);
      setMood(null);
    }, 60000);
    return () => clearInterval(timer);
  }, [asleep]);
  useEffect(() => {
    if (!motionOn || asleep) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      bounce.setValue(0);
    };
  }, [motionOn, asleep, bounce]);
  useEffect(() => {
    if (!waving) return;
    const timer = setTimeout(() => setWaving(false), WAVE_MS);
    return () => clearTimeout(timer);
  }, [waving]);
  useEffect(() => {
    const timer = setTimeout(() => setAsleep(true), IDLE_MS);
    return () => clearTimeout(timer);
  }, [activity]);
  useEffect(() => {
    const timer = setInterval(() => {
      const night = isNight(new Date().getHours());
      if (night && !wasNight.current) setAsleep(true);
      wasNight.current = night;
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  if (!visible) {
    return (
      <Text variant="caption" numberOfLines={1} style={styles.text}>
        {fallback}
      </Text>
    );
  }
  const pose: PushyPose = asleep
    ? 'sleep'
    : message && mood === 'missed'
      ? 'sad'
      : message && mood === 'won'
        ? 'cheer'
        : waving
          ? 'wave'
          : recording
            ? 'run'
            : 'sit';
  return (
    <View style={styles.row}>
      <Text variant="caption" numberOfLines={2} style={styles.text}>
        {asleep ? de.coach.asleep : (message ?? fallback)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={asleep ? de.coach.wake : de.coach.sleep}
        onPress={toggleSleep}
        style={styles.pushy}
      >
        <Animated.View
          style={{
            transform: [
              {
                translateY: Animated.add(
                  bounce.interpolate({ inputRange: [0, 1], outputRange: [0, recording ? -4 : -2] }),
                  hop.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -8, 0] }),
                ),
              },
            ],
          }}
        >
          <Pushy pose={pose} scale={0.5 + stage * 0.03} />
        </Animated.View>
        {asleep ? (
          <Text variant="caption" color="accent" style={styles.zzz}>
            {de.coach.zzz}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  text: { flex: 1, textAlign: 'right' },
  pushy: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zzz: { position: 'absolute', top: 0, right: 0 },
});
