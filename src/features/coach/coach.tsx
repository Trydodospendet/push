import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  useAnimatedValue,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useClock } from '@/features/gps/use-clock';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { addDays, toLocalDate } from '@/lib/dates';
import { secureStorage } from '@/lib/secure-storage';
import { de } from '@/i18n/de';
import { colors, radius, spacing } from '@/theme';
import { coachStage, currentSpeed } from './model';
import { useLiveSpeed } from './use-live-speed';
import { useMotionEnabled } from '@/features/preferences/motion';
import { Mascot } from './mascot';
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
  const { recorder } = useGps();
  const now = useClock(true);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [flip, setFlip] = useState(0);
  const [visit, setVisit] = useState(0);
  const handled = useRef(-1);
  const lastQuote = useRef(-1);
  const motionOn = useMotionEnabled();
  const bounce = useAnimatedValue(0);
  const celebration = useAnimatedValue(0);
  const wiggle = useAnimatedValue(0);
  const [position] = useState(
    () =>
      new Animated.ValueXY({
        x: Math.max(8, width - 90),
        y: Math.max(insets.top, height - insets.bottom - 190),
      }),
  );
  const origin = useRef({
    x: Math.max(8, width - 90),
    y: Math.max(insets.top, height - insets.bottom - 190),
  });
  const [gaze, setGaze] = useState(0);
  const [bubbleLeft, setBubbleLeft] = useState(-130);
  const switchMode = useCallback(() => {
    setSpeedMode((wasShowingSpeed) => {
      if (wasShowingSpeed && motionOn) {
        celebration.setValue(0);
        Animated.sequence([
          Animated.timing(celebration, { toValue: 1, duration: 210, useNativeDriver: true }),
          Animated.timing(celebration, { toValue: 2, duration: 210, useNativeDriver: true }),
        ]).start();
        setFlip((value) => value + 1);
      }
      return !wasShowingSpeed;
    });
  }, [celebration, motionOn]);
  const bounds = useCallback(
    (x: number, y: number) => ({
      x: Math.max(8, Math.min(width - 88, x)),
      y: Math.max(insets.top + 50, Math.min(height - insets.bottom - 150, y)),
    }),
    [width, height, insets.top, insets.bottom],
  );
  const responder = useMemo(
    () =>
      // Gesture callbacks read refs only when a touch occurs.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: (_, g) => {
          position.setValue({
            x: Math.max(8, Math.min(width - 88, origin.current.x + g.dx)),
            y: Math.max(
              insets.top + 50,
              Math.min(height - insets.bottom - 150, origin.current.y + g.dy),
            ),
          });
          setGaze(g.dx > 0 ? 2 : -2);
        },
        onPanResponderRelease: (_, g) => {
          const next = {
            x: Math.max(8, Math.min(width - 88, origin.current.x + g.dx)),
            y: Math.max(
              insets.top + 50,
              Math.min(height - insets.bottom - 150, origin.current.y + g.dy),
            ),
          };
          origin.current = next;
          setBubbleLeft(next.x > width / 2 ? -130 : 0);
          position.setValue(next);
          setDragging(false);
          if (Math.abs(g.dx) + Math.abs(g.dy) < 8) switchMode();
        },
        onPanResponderTerminate: () => {
          position.setValue(origin.current);
          setDragging(false);
        },
      }),
    [height, width, insets.top, insets.bottom, position, switchMode],
  );
  useEffect(() => {
    const next = bounds(origin.current.x, origin.current.y);
    origin.current = next;
    position.setValue(next);
  }, [width, height, insets.top, insets.bottom, position, bounds]);
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
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 10000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const next = (lastQuote.current + 1) % de.challengeStart.quotes.length;
      lastQuote.current = next;
      setMessage(de.challengeStart.quotes[next]);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const liveSpeed = useLiveSpeed(speedMode && !hidden && recorder.status !== 'recording');
  useEffect(() => {
    if (!motionOn) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: dragging ? 100 : 1200,
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: dragging ? 100 : 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    const eyes = setInterval(() => setGaze((g) => (g === 2 ? -2 : 2)), 4000);
    return () => {
      animation.stop();
      clearInterval(eyes);
      bounce.setValue(0);
    };
  }, [motionOn, dragging, bounce]);
  useEffect(() => {
    if (!motionOn || speedMode || hidden) return;
    const timer = setInterval(() => {
      wiggle.setValue(0);
      Animated.sequence([
        Animated.timing(wiggle, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }, 18000);
    return () => clearInterval(timer);
  }, [hidden, motionOn, speedMode, wiggle]);
  const speed =
    recorder.status === 'recording'
      ? currentSpeed(recorder.points, now)
      : liveSpeed && now - liveSpeed.at < 10000
        ? liveSpeed.speed
        : null;
  if (hidden)
    return (
      <Pressable
        style={[styles.restore, { bottom: insets.bottom + 75 }]}
        accessibilityLabel={de.coach.show}
        onPress={() => setHidden(false)}
      >
        <Text color="accent">●</Text>
      </Pressable>
    );
  return (
    <Animated.View
      style={[styles.root, { transform: position.getTranslateTransform() }]}
      pointerEvents="box-none"
    >
      {message && !speedMode ? (
        <View pointerEvents="none" style={[styles.bubble, { left: bubbleLeft }]}>
          <Text variant="caption">{message}</Text>
        </View>
      ) : null}
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={de.coach.move}
        onAccessibilityTap={switchMode}
      >
        {speedMode ? (
          <View style={styles.speed}>
            <Text variant="heading" color="accent">
              {speed === null ? '0' : speed.toFixed(1)}
            </Text>
            <Text variant="caption">{de.coach.speed}</Text>
          </View>
        ) : (
          <Animated.View
            key={flip}
            style={{
              transform: [
                {
                  translateY: Animated.add(
                    bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
                    celebration.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -17, 0] }),
                  ),
                },
                {
                  rotate: dragging
                    ? bounce.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] })
                    : Animated.add(
                        celebration.interpolate({
                          inputRange: [0, 1, 2],
                          outputRange: [0, 180, 360],
                        }),
                        wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] }),
                      ).interpolate({
                        inputRange: [-8, 0, 360, 368],
                        outputRange: ['-8deg', '0deg', '360deg', '368deg'],
                      }),
                },
              ],
            }}
          >
            <Mascot stage={stage} dizzy={dragging} gaze={gaze} />
          </Animated.View>
        )}
      </View>
      <Text variant="caption" color="accent">
        {de.coach.name}
      </Text>
      <Pressable accessibilityLabel={de.coach.hide} onPress={() => setHidden(true)}>
        <Text variant="caption" color="textMuted">
          ×
        </Text>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, width: 80, alignItems: 'center', zIndex: 20 },
  bubble: {
    position: 'absolute',
    bottom: 120,
    width: 200,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
  },
  speed: {
    width: 100,
    padding: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  restore: { position: 'absolute', right: 8, padding: spacing.sm, zIndex: 20 },
});
