import { useQueryClient } from '@tanstack/react-query';
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
import { AppState } from 'react-native';

import { challengeKeys } from '@/features/challenges/api';
import { toUserMessage } from '@/lib/errors';

import { activityKeys } from './api';
import { getHealthAdapter } from './native';
import { initialHealthState, loadHealthState, saveHealthState, type HealthState } from './storage';
import { uploadSnapshot } from './sync';

/** Automatic syncs (app start, return to foreground) run at most this often. */
const AUTO_SYNC_INTERVAL_MS = 60_000;

type HealthContextValue = {
  /** False until the stored state of the signed-in user has been read. */
  ready: boolean;
  introDone: boolean;
  connected: boolean;
  lastSyncAt: string | null;
  syncing: boolean;
  /** German message of the last failed connect or sync. */
  error: string | null;
  /** Shows the system permission dialog. Resolves to true if access was granted. */
  connect: () => Promise<boolean>;
  /** The user postponed the connection on the explanation screen. */
  skip: () => Promise<void>;
  /** Reads the phone's health data and uploads it. Never rejects. */
  sync: () => Promise<void>;
};

const HealthContext = createContext<HealthContextValue | null>(null);

type HealthProviderProps = {
  /** Null while signed out. */
  userId: string | null;
  /** Timezone of the profile; days are cut in this timezone. */
  timezone: string;
  children: ReactNode;
};

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

export function HealthProvider({ userId, timezone, children }: HealthProviderProps) {
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState<{ userId: string; state: HealthState } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<HealthState>(initialHealthState);
  const running = useRef<Promise<void> | null>(null);

  const state = userId !== null && loaded?.userId === userId ? loaded.state : null;

  useEffect(() => {
    stateRef.current = state ?? initialHealthState;
  }, [state]);

  useEffect(() => {
    if (userId === null) {
      return;
    }
    let cancelled = false;
    void loadHealthState(userId).then((stored) => {
      if (!cancelled) {
        setLoaded({ userId, state: stored });
        setError(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<HealthState>) => {
      if (userId === null) {
        return;
      }
      const next = { ...stateRef.current, ...patch };
      stateRef.current = next;
      setLoaded({ userId, state: next });
      await saveHealthState(userId, next);
    },
    [userId],
  );

  const runSync = useCallback(
    async (automatic: boolean) => {
      const current = stateRef.current;
      if (userId === null || !current.connected) {
        return;
      }
      if (running.current) {
        return running.current;
      }
      if (
        automatic &&
        current.lastSyncAt !== null &&
        Date.now() - Date.parse(current.lastSyncAt) < AUTO_SYNC_INTERVAL_MS
      ) {
        return;
      }

      const task = (async () => {
        setSyncing(true);
        try {
          const now = new Date();
          const adapter = await getHealthAdapter();
          const snapshot = await adapter.read(
            timezone,
            now,
            new Date(current.firstAuthorizedAt ?? now),
          );
          await uploadSnapshot(snapshot);
          await update({ lastSyncAt: now.toISOString() });
          setError(null);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: challengeKeys.all }),
            queryClient.invalidateQueries({ queryKey: activityKeys.all }),
          ]);
        } catch (syncError) {
          setError(toUserMessage(syncError));
          if (errorCode(syncError) === 'health_permission') {
            // The permission was revoked in the system settings.
            await update({ connected: false });
          }
        } finally {
          running.current = null;
          setSyncing(false);
        }
      })();
      running.current = task;
      return task;
    },
    [queryClient, timezone, update, userId],
  );

  const connect = useCallback(async () => {
    try {
      const adapter = await getHealthAdapter();
      if (!(await adapter.available())) {
        throw new Error('health_unavailable');
      }
      const granted = await adapter.authorize();
      await update({
        introDone: true,
        connected: granted,
        firstAuthorizedAt: granted
          ? (stateRef.current.firstAuthorizedAt ?? new Date().toISOString())
          : stateRef.current.firstAuthorizedAt,
      });
      if (!granted) {
        throw new Error('health_permission');
      }
      setError(null);
      void runSync(false);
      return true;
    } catch (connectError) {
      setError(toUserMessage(connectError));
      return false;
    }
  }, [runSync, update]);

  const skip = useCallback(() => update({ introDone: true }), [update]);
  const sync = useCallback(() => runSync(false).catch(() => undefined), [runSync]);

  const connected = state?.connected ?? false;
  useEffect(() => {
    if (!connected) {
      return;
    }
    // App start (or right after connecting) and every return to the foreground.
    void runSync(true);
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        void runSync(true);
      }
    });
    return () => subscription.remove();
  }, [connected, runSync]);

  const value = useMemo<HealthContextValue>(
    () => ({
      ready: userId === null || state !== null,
      introDone: state?.introDone ?? false,
      connected,
      lastSyncAt: state?.lastSyncAt ?? null,
      syncing,
      error,
      connect,
      skip,
      sync,
    }),
    [connect, connected, error, skip, state, sync, syncing, userId],
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthContextValue {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used inside <HealthProvider>.');
  }
  return context;
}
