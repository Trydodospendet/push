import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
/** Foreground-only speed preview; never uploads or stores a route. */
export function useLiveSpeed(enabled: boolean) {
  const [sample, setSample] = useState<{ speed: number; at: number } | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let generation = 0;
    let subscription: Location.LocationSubscription | null = null;
    const stop = () => {
      generation += 1;
      subscription?.remove();
      subscription = null;
      setSample(null);
    };
    const start = async () => {
      const attempt = ++generation;
      subscription?.remove();
      subscription = null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (
        cancelled ||
        attempt !== generation ||
        permission.status !== 'granted' ||
        AppState.currentState !== 'active'
      )
        return;
      const watch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 1 },
        (position) => {
          const { speed, accuracy } = position.coords;
          setSample(
            speed !== null && speed >= 0 && speed <= 12 && accuracy !== null && accuracy <= 25
              ? { speed: speed * 3.6, at: position.timestamp }
              : null,
          );
        },
      );
      if (cancelled || attempt !== generation || AppState.currentState !== 'active') watch.remove();
      else subscription = watch;
    };
    void start().catch(() => setSample(null));
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void start().catch(() => setSample(null));
      else stop();
    });
    return () => {
      cancelled = true;
      app.remove();
      subscription?.remove();
    };
  }, [enabled]);
  return enabled ? sample : null;
}
