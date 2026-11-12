import {
  aggregateRecord, ExerciseType, getGrantedPermissions, getSdkStatus, initialize,
  readRecords, requestPermission, SdkAvailabilityStatus,
  type Permission, type RecordType, type RecordResult,
} from 'react-native-health-connect';

import { eligibleOrigins, healthDays } from './days';
import type { HealthAdapter, WorkoutInput, DayInput } from './types';

const permissions: Permission[] = ['ExerciseSession', 'Distance', 'Steps'].map(recordType => ({
  accessType: 'read', recordType: recordType as Permission['recordType'],
}));
const complete = (granted: Awaited<ReturnType<typeof requestPermission>>) =>
  permissions.every(p => granted.some(g => 'recordType' in g && g.recordType === p.recordType && g.accessType === 'read'));

async function records<T extends RecordType>(type: T, start: Date, end: Date, origins?: string[]) {
  const result: RecordResult<T>[] = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(type, {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      pageSize: 1000, pageToken, dataOriginFilter: origins,
    });
    result.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return result;
}

export const adapter: HealthAdapter = {
  available: async () => (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE && await initialize(),
  authorize: async () => complete(await requestPermission(permissions)),
  read: async (timezone, now, firstAuthorizedAt) => {
    if (!await initialize() || !complete(await getGrantedPermissions())) throw new Error('health_permission');
    // Android's default permission only exposes the 30 days before first authorization.
    // No extra history/background permission is requested. Never overwrite inaccessible days with zero.
    const earliest = new Date(Math.max(now.getTime() - 45 * 86400000 + 60000,
      firstAuthorizedAt.getTime() - 30 * 86400000 + 60000));
    const sessions = await records('ExerciseSession', earliest, now);
    const workouts: WorkoutInput[] = [];
    for (const session of sessions) {
      if (session.exerciseType !== ExerciseType.RUNNING && session.exerciseType !== ExerciseType.RUNNING_TREADMILL) continue;
      const start = new Date(session.startTime), end = new Date(session.endTime);
      if (start < earliest || end > now) continue;
      const id = session.metadata?.id, origin = session.metadata?.dataOrigin;
      if (!id || !origin) throw new Error('health_missing_origin');
      const distances = await records('Distance', start, end, [origin]);
      const manual = session.metadata?.recordingMethod === 3 || distances.some(d => d.metadata?.recordingMethod === 3);
      const distance = manual ? 0 : (await aggregateRecord({
        recordType: 'Distance', dataOriginFilter: [origin],
        timeRangeFilter: { operator: 'between', startTime: session.startTime, endTime: session.endTime },
      })).DISTANCE?.inMeters ?? 0;
      workouts.push({ platform: 'android', source_record_id: id, source_name: origin,
        activity_type: 'running', start_at: session.startTime, end_at: session.endTime,
        distance_m: Math.round(distance), duration_s: Math.floor((end.getTime() - start.getTime()) / 1000),
        was_user_entered: manual });
    }
    const days: DayInput[] = [];
    for (const day of healthDays(timezone, now, earliest)) {
      const sourceRecords = await records('Steps', day.start, day.end);
      const { origins, excluded } = eligibleOrigins(sourceRecords);
      // An empty filter means ALL sources to Health Connect, never pass [] here.
      const steps = origins.length === 0 ? 0 : (await aggregateRecord({
        recordType: 'Steps', dataOriginFilter: origins,
        timeRangeFilter: { operator: 'between', startTime: day.start.toISOString(), endTime: day.end.toISOString() },
      })).COUNT_TOTAL ?? 0;
      days.push({ date: day.date, platform: 'android', steps: Math.round(steps), excluded_sources: excluded });
    }
    return { workouts, days };
  },
};
