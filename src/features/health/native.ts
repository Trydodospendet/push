import { Platform } from 'react-native';
import type { HealthAdapter } from './types';

/** Loading is deferred so an old build can still display a useful error instead of crashing on startup. */
export async function getHealthAdapter(): Promise<HealthAdapter> {
  try {
    if (Platform.OS === 'android') return (await import('./healthconnect')).adapter;
    if (Platform.OS === 'ios') return (await import('./healthkit')).adapter;
  } catch {
    throw new Error('health_build_required');
  }
  throw new Error('health_unavailable');
}
