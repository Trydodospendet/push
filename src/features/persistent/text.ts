import type { GoalType } from '@/config/app';
import { de } from '@/i18n/de';

const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const kmExact = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export type PersistentGoal = {
  goalType: GoalType;
  targetValue: number;
  /** Server value: metres, steps or days reached. */
  progress: number;
  /** Valid steps of today (for daily step goals). */
  stepsToday: number;
};

/** Text of the permanent notification for the main goal, e.g. "3 km am Stück: noch 1,8 km". */
export function goalText(goal: PersistentGoal): string {
  switch (goal.goalType) {
    case 'run_single':
    case 'run_total': {
      const left = goal.targetValue - goal.progress;
      if (left <= 0) return de.persistent.reached;
      const label =
        goal.goalType === 'run_single' ? de.persistent.runSingle : de.persistent.runTotal;
      return `${kmFormat.format(goal.targetValue / 1000)} km ${label}: ${de.persistent.left} ${kmFormat.format(left / 1000)} km`;
    }
    case 'steps_daily':
      return `${integerFormat.format(goal.stepsToday)} / ${integerFormat.format(goal.targetValue)} ${de.persistent.stepsToday}`;
    case 'steps_total':
      return `${integerFormat.format(goal.progress)} / ${integerFormat.format(goal.targetValue)} ${de.progress.unitSteps}`;
  }
}

/** Text while a GPS run is being recorded. */
export function runText(distanceM: number): string {
  return `${de.persistent.run}: ${kmExact.format(distanceM / 1000)} km`;
}
