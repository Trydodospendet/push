export type HealthPlatform = 'android' | 'ios';
export type WorkoutInput = {
  platform: HealthPlatform;
  source_record_id: string;
  source_name: string;
  activity_type: 'running';
  start_at: string;
  end_at: string;
  distance_m: number;
  duration_s: number;
  was_user_entered: boolean;
};
export type DayInput = {
  date: string;
  platform: HealthPlatform;
  steps: number;
  excluded_sources: number;
};
export type HealthSnapshot = { workouts: WorkoutInput[]; days: DayInput[] };
export type HealthAdapter = {
  available: () => Promise<boolean>;
  authorize: () => Promise<boolean>;
  read: (timezone: string, now: Date, firstAuthorizedAt: Date) => Promise<HealthSnapshot>;
};
