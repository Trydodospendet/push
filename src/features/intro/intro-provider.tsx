import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { loadIntroSeen, saveIntroSeen } from './storage';

type IntroContextValue = {
  /** False until the stored flag of the signed-in user has been read. */
  ready: boolean;
  seen: boolean;
  markSeen: () => void;
};

const IntroContext = createContext<IntroContextValue | null>(null);

type IntroProviderProps = {
  /** Null while signed out. */
  userId: string | null;
  children: ReactNode;
};

export function IntroProvider({ userId, children }: IntroProviderProps) {
  const [loaded, setLoaded] = useState<{ userId: string; seen: boolean } | null>(null);

  useEffect(() => {
    if (userId === null) {
      return;
    }
    let cancelled = false;
    void loadIntroSeen(userId).then((stored) => {
      if (!cancelled) {
        setLoaded({ userId, seen: stored });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markSeen = useCallback(() => {
    if (userId === null) {
      return;
    }
    setLoaded({ userId, seen: true });
    void saveIntroSeen(userId).catch(() => undefined);
  }, [userId]);

  const current = userId !== null && loaded?.userId === userId ? loaded : null;
  const value = useMemo<IntroContextValue>(
    () => ({
      ready: userId === null || current !== null,
      seen: current?.seen ?? false,
      markSeen,
    }),
    [current, markSeen, userId],
  );

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function useIntro(): IntroContextValue {
  const context = useContext(IntroContext);
  if (!context) {
    throw new Error('useIntro must be used inside <IntroProvider>.');
  }
  return context;
}
