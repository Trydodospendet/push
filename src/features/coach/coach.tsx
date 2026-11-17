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
import { formatSpeed } from '@/features/gps/format';
import { currentSpeed } from '@/features/gps/speed';
import { useClock } from '@/features/gps/use-clock';
import { useLiveSpeed } from '@/features/gps/use-live-speed';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { addDays, toLocalDate } from '@/lib/dates';
import { secureStorage } from '@/lib/secure-storage';
import { FurNumber } from '@/features/fur/fur-number';
import { de } from '@/i18n/de';
import { colors, radius, spacing } from '@/theme';
import { coachStage, isNight } from './model';
import type { PushyPose } from '@/features/fur/images';
import { hapticSelect, hapticTap } from '@/features/preferences/haptics';
import { useMotionEnabled } from '@/features/preferences/motion';
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const showingSpeed = speedMode && !hidden;
  const recording = recorder.status === 'recording';
  const now = useClock(showingSpeed && recording);
  const [flip, setFlip] = useState(0);
  const [visit, setVisit] = useState(0);
  const handled = useRef(-1);
  const lastQuote = useRef(-1);
  const motionOn = useMotionEnabled();
  const bounce = useAnimatedValue(0);
  const celebration = useAnimatedValue(0);
  const wiggle = useAnimatedValue(0);
  const hop = useAnimatedValue(0);
  const pokes = useRef(0);
  const shaking = useRef({ direction: 0, flips: 0, startedAt: 0, lastX: 0 });
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
  const [mood, setMood] = useState<'won' | 'missed' | null>(null);
  const [waving, setWaving] = useState(false);
  const [idle, setIdle] = useState(false);
  const [activity, setActivity] = useState(0);
  const [night, setNight] = useState(() => isNight(new Date().getHours()));
  const [bubbleLeft, setBubbleLeft] = useState(-130);
  const spinOnce = useCallback(() => {
    if (!motionOn) return;
    celebration.setValue(0);
    Animated.sequence([
      Animated.timing(celebration, { toValue: 1, duration: 210, useNativeDriver: true }),
      Animated.timing(celebration, { toValue: 2, duration: 210, useNativeDriver: true }),
    ]).start();
    setFlip((value) => value + 1);
  }, [celebration, motionOn]);
  /** A tap: Pushy hops, says something short and gives a little feedback. */
  const poke = useCallback(() => {
    hapticTap();
    playSound('pop');
    setIdle(false);
    setActivity((value) => value + 1);
    setWaving(true);
    pokes.current += 1;
    setMessage(de.coach.pokes[pokes.current % de.coach.pokes.length]);
    if (!motionOn) return;
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.timing(hop, { toValue: 2, duration: 170, useNativeDriver: true }),
    ]).start();
  }, [hop, motionOn, setIdle, setActivity, setWaving]);
  /** Shaking Pushy to and fro makes it dizzy: one spin and a complaint. */
  const dizzy = useCallback(() => {
    hapticSelect();
    playSound('tick');
    setMessage(de.coach.shaken);
    spinOnce();
  }, [spinOnce]);
  const switchMode = useCallback(() => {
    setSpeedMode((wasShowingSpeed) => {
      if (wasShowingSpeed) spinOnce();
      return !wasShowingSpeed;
    });
  }, [spinOnce]);
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
        onPanResponderGrant: (event) => {
          hapticTap();
          shaking.current = {
            direction: 0,
            flips: 0,
            startedAt: event.nativeEvent.timestamp,
            lastX: 0,
          };
          setDragging(true);
        },
        onPanResponderMove: (event, g) => {
          const shake = shaking.current;
          const step = g.dx - shake.lastX;
          if (Math.abs(step) >= 14) {
            const direction = step > 0 ? 1 : -1;
            if (shake.direction !== 0 && direction !== shake.direction) shake.flips += 1;
            shake.direction = direction;
            shake.lastX = g.dx;
            if (event.nativeEvent.timestamp - shake.startedAt > 900) {
              shake.flips = 0;
              shake.startedAt = event.nativeEvent.timestamp;
            }
            if (shake.flips >= 4) {
              shake.flips = 0;
              shake.startedAt = event.nativeEvent.timestamp;
              dizzy();
            }
          }
          position.setValue({
            x: Math.max(8, Math.min(width - 88, origin.current.x + g.dx)),
            y: Math.max(
              insets.top + 50,
              Math.min(height - insets.bottom - 150, origin.current.y + g.dy),
            ),
          });
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
          if (Math.abs(g.dx) + Math.abs(g.dy) < 8) {
            poke();
            switchMode();
          }
        },
        onPanResponderTerminate: () => {
          position.setValue(origin.current);
          setDragging(false);
        },
      }),
    [height, width, insets.top, insets.bottom, position, switchMode, poke, dizzy],
  );
  useEffect(() => {
    const next = bounds(origin.current.x, origin.current.y);
    origin.current = next;
    position.setValue(next);
  }, [width, height, insets.top, insets.bottom, position, bounds]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setVisit((v) => v + 1);
        setIdle(false);
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
      if (AppState.currentState !== 'active') return;
      const next = (lastQuote.current + 1) % de.challengeStart.quotes.length;
      lastQuote.current = next;
      setMessage(de.challengeStart.quotes[next]);
      setMood(null);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const { speed: previewSpeed } = useLiveSpeed(
    showingSpeed && !recording && recorder.status !== 'paused',
  );
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
    return () => {
      animation.stop();
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
  useEffect(() => {
    if (!waving) return;
    const timer = setTimeout(() => setWaving(false), WAVE_MS);
    return () => clearTimeout(timer);
  }, [waving]);
  useEffect(() => {
    const timer = setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(timer);
  }, [activity]);
  useEffect(() => {
    const timer = setInterval(() => setNight(isNight(new Date().getHours())), 60000);
    return () => clearInterval(timer);
  }, []);
  const pose: PushyPose = dragging
    ? 'dizzy'
    : night || idle
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
  const speed =
    showingSpeed && recording ? currentSpeed(recorder.points, now, recorder.segment) : previewSpeed;
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
            <FurNumber value={formatSpeed(speed)} height={26} maxWidth={72} />
            <Text variant="caption">{de.coach.speed}</Text>
          </View>
        ) : (
          <Animated.View
            key={flip}
            style={{
              transform: [
                {
                  translateY: Animated.add(
                    bounce.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, recording ? -9 : -3],
                    }),
                    Animated.add(
                      celebration.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -17, 0] }),
                      hop.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -22, 0] }),
                    ),
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
            <Pushy pose={pose} scale={0.9 + stage * 0.05} />
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
    width: '100%',
    padding: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  restore: { position: 'absolute', right: 8, padding: spacing.sm, zIndex: 20 },
});
