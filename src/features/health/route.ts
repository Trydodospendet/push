import { Platform } from 'react-native';

import type { MapPoint } from '@/features/gps/route-map';

export type RouteResult =
  | { kind: 'route'; points: MapPoint[] }
  | { kind: 'none' }
  | { kind: 'denied' }
  | { kind: 'unsupported' };

/**
 * Asks Health Connect for the route of one exercise session. Android shows its own consent
 * dialog for every single route; the route is only shown on the phone and never uploaded.
 */
export async function readHealthConnectRoute(recordId: string): Promise<RouteResult> {
  if (Platform.OS !== 'android') {
    return { kind: 'unsupported' };
  }
  try {
    const { requestExerciseRoute } = await import('react-native-health-connect');
    const locations = await requestExerciseRoute(recordId);
    const points = locations.map((location) => ({
      lat: location.latitude,
      lng: location.longitude,
      segment: 0,
    }));
    return points.length >= 2 ? { kind: 'route', points } : { kind: 'none' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return message.toLowerCase().includes('denied') ? { kind: 'denied' } : { kind: 'none' };
  }
}
