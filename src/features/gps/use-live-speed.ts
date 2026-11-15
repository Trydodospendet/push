import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

import { currentSpeed, SPEED_WINDOW_MS } from './speed';
import { useClock } from './use-clock';

type Fix = {
  lat: number;
  lng: number;
  t: number;
  accuracy: number;
  mocked: boolean;
  speedMs: number | null;
};

export function useLiveSpeed(enabled: boolean) {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const clock = useClock(enabled);

  useEffect(() => {
    if (!enabled) return;
    let generation = 0;
    let subscription: Location.LocationSubscription | null = null;

    const stop = () => {
      generation += 1;
      subscription?.remove();
      subscription = null;
    };

    const start = async () => {
      stop();
      const attempt = generation;
      setFixes([]);
      setUnavailable(false);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (attempt !== generation || AppState.currentState !== 'active') return;
        if (!permission.granted) {
          setUnavailable(true);
          return;
        }
        const watch = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
          ({ coords, timestamp, mocked }) => {
            if (attempt !== generation || AppState.currentState !== 'active') return;
            setUnavailable(false);
            setFixes((previous) => {
              if (timestamp <= (previous.at(-1)?.t ?? 0)) return previous;
              return [
                ...previous.filter((fix) => timestamp - fix.t <= SPEED_WINDOW_MS).slice(-9),
                {
                  lat: coords.latitude,
                  lng: coords.longitude,
                  t: timestamp,
                  accuracy: coords.accuracy ?? Infinity,
                  mocked: mocked === true,
                  speedMs: coords.speed,
                },
              ];
            });
          },
          () => {
            if (attempt === generation) {
              setFixes([]);
              setUnavailable(true);
            }
          },
        );
        if (attempt === generation) subscription = watch;
        else watch.remove();
      } catch {
        if (attempt === generation) setUnavailable(true);
      }
    };

    if (AppState.currentState === 'active') void start();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void start();
      else {
        stop();
        setFixes([]);
      }
    });
    return () => {
      stop();
      app.remove();
    };
  }, [enabled]);

  return {
    speed: enabled ? currentSpeed(fixes, clock) : null,
    unavailable: enabled && unavailable,
  };
}
