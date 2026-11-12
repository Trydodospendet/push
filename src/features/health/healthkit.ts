import {
  isHealthDataAvailable, requestAuthorization, queryWorkoutSamples, queryStatisticsForQuantity,
  WorkoutActivityType, ComparisonPredicateOperator,
} from '@kingstinct/react-native-healthkit';

import { healthDays } from './days';
import type { HealthAdapter, WorkoutInput, DayInput } from './types';

export const adapter: HealthAdapter = {
  available: async () => isHealthDataAvailable(),
  // HealthKit deliberately does not disclose whether read permission was granted.
  authorize: () => requestAuthorization({ toRead: [
    'HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierDistanceWalkingRunning', 'HKQuantityTypeIdentifierStepCount',
  ] }),
  read: async (timezone, now) => {
    const startDate = new Date(now.getTime() - 45 * 86400000 + 60000);
    const samples = await queryWorkoutSamples({ limit: 0, filter: {
      workoutActivityType: WorkoutActivityType.running,
      date: { startDate, endDate: now, strictStartDate: true, strictEndDate: true },
    } });
    const workouts: WorkoutInput[] = [];
    for (const workout of samples) {
      const statistic = await workout.getStatistic('HKQuantityTypeIdentifierDistanceWalkingRunning', 'm');
      workouts.push({ platform: 'ios', source_record_id: workout.uuid,
        source_name: workout.sourceRevision.source.name, activity_type: 'running',
        start_at: workout.startDate.toISOString(), end_at: workout.endDate.toISOString(),
        distance_m: Math.round(statistic?.sumQuantity?.quantity ?? 0),
        duration_s: Math.floor(workout.duration.quantity),
        was_user_entered: workout.metadata.HKWasUserEntered === true });
    }
    const days: DayInput[] = [];
    for (const day of healthDays(timezone, now)) {
      const total = await queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
        unit: 'count', filter: {
          date: { startDate: day.start, endDate: day.end },
          NOT: [{ metadata: { withMetadataKey: 'HKWasUserEntered', operatorType: ComparisonPredicateOperator.equalTo, value: true } }],
        },
      });
      days.push({ date: day.date, platform: 'ios', steps: Math.round(total.sumQuantity?.quantity ?? 0), excluded_sources: 0 });
    }
    return { workouts, days };
  },
};
