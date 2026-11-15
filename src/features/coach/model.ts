export function coachStage(activeDays: number): number {
  return activeDays < 2 ? 0 : activeDays < 7 ? 1 : activeDays < 30 ? 2 : activeDays < 90 ? 3 : 4;
}
