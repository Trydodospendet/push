export function coachStage(activeDays: number): number {
  return activeDays < 2 ? 0 : activeDays < 7 ? 1 : activeDays < 30 ? 2 : activeDays < 90 ? 3 : 4;
}

/** Pushy sleeps at night, from ten in the evening until six in the morning. */
export function isNight(hour: number): boolean {
  return hour >= 22 || hour < 6;
}
