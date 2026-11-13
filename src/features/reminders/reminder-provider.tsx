import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useMyChallenges } from '@/features/challenges/api';
import { useMyProgress } from '@/features/health/api';
import type { GoalType } from '@/config/app';

import {
  applyPlan,
  cancelAll,
  configureNotificationHandler,
  getPermissionState,
  requestPermission,
  type PermissionState,
} from './notifications';
import {
  defaultReminderSettings,
  planReminders,
  type ReminderChallenge,
  type ReminderSettings,
} from './plan';
import { loadReminderSettings, saveReminderSettings } from './storage';

type ReminderContextValue = {
  ready: boolean;
  settings: ReminderSettings;
  permission: PermissionState;
  /** Turning on asks for the system permission first; resolves to the resulting state. */
  setEnabled: (enabled: boolean) => Promise<void>;
  setTime: (hour: number, minute: number) => Promise<void>;
};

const ReminderContext = createContext<ReminderContextValue | null>(null);

export function ReminderProvider({
  userId,
  children,
}: {
  /** Null while signed out. */
  userId: string | null;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ userId: string; settings: ReminderSettings } | null>(null);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const settingsRef = useRef<ReminderSettings>(defaultReminderSettings);

  const settings = userId !== null && loaded?.userId === userId ? loaded.settings : null;

  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (userId === null) {
      // Nobody is signed in: reminders of the previous account must not stay on the phone.
      void cancelAll().catch(() => undefined);
      return;
    }
    let cancelled = false;
    void Promise.all([loadReminderSettings(userId), getPermissionState().catch(() => null)]).then(
      ([stored, state]) => {
        if (cancelled) {
          return;
        }
        settingsRef.current = stored;
        setLoaded({ userId, settings: stored });
        if (state !== null) {
          setPermission(state);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (next: ReminderSettings) => {
      if (userId === null) {
        return;
      }
      settingsRef.current = next;
      setLoaded({ userId, settings: next });
      await saveReminderSettings(userId, next);
    },
    [userId],
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        await save({ ...settingsRef.current, enabled: false });
        return;
      }
      const state = await requestPermission().catch((): PermissionState => 'denied');
      setPermission(state);
      await save({ ...settingsRef.current, enabled: state === 'granted' });
    },
    [save],
  );

  const setTime = useCallback(
    (hour: number, minute: number) => save({ ...settingsRef.current, hour, minute }),
    [save],
  );

  const value = useMemo<ReminderContextValue>(
    () => ({
      ready: userId === null || settings !== null,
      settings: settings ?? defaultReminderSettings,
      permission,
      setEnabled,
      setTime,
    }),
    [permission, setEnabled, setTime, settings, userId],
  );

  return (
    <ReminderContext.Provider value={value}>
      {userId !== null && settings !== null ? (
        <ReminderScheduler userId={userId} settings={settings} />
      ) : null}
      {children}
    </ReminderContext.Provider>
  );
}

/** Plans the notifications again whenever challenges, progress or settings change. */
function ReminderScheduler({ userId, settings }: { userId: string; settings: ReminderSettings }) {
  const challenges = useMyChallenges(userId);
  const progress = useMyProgress(userId);

  const mine = challenges.data;
  const progressData = progress.data;

  useEffect(() => {
    if (!settings.enabled) {
      void cancelAll().catch(() => undefined);
      return;
    }
    if (mine === undefined || progressData === undefined) {
      return;
    }
    const joined: ReminderChallenge[] = mine
      .filter((challenge) => challenge.isParticipant)
      .map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        goalType: challenge.goal_type as GoalType,
        targetValue: challenge.target_value,
        status: challenge.status,
        startsAt: challenge.starts_at,
        endsAt: challenge.ends_at,
        syncGraceHours: challenge.sync_grace_hours,
      }));
    void applyPlan(planReminders(joined, progressData, settings, new Date())).catch(
      () => undefined,
    );
  }, [mine, progressData, settings]);

  return null;
}

export function useReminders(): ReminderContextValue {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useReminders must be used inside <ReminderProvider>.');
  }
  return context;
}
