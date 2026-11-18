import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { MapPoint } from './route-map';

/** One position fix for the map before a run starts; null until permission and a fix exist. */
export function useCurrentPosition(): MapPoint | null {
  const [position, setPosition] = useState<MapPoint | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return;
        const known = await Location.getLastKnownPositionAsync();
        if (known && !cancelled) {
          setPosition({ lat: known.coords.latitude, lng: known.coords.longitude, segment: 0 });
        }
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setPosition({ lat: fresh.coords.latitude, lng: fresh.coords.longitude, segment: 0 });
        }
      } catch {
        // No fix: the map simply stays where it is.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return position;
}
