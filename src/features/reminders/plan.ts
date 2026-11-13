import type { GoalType } from '@/config/app';
import { de } from '@/i18n/de';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Daily reminders are planned this many days ahead; every sync plans them again. */
const DAILY_HORIZON_DAYS = 3;
/** The server settles on the next 5-minute run after the grace period; wait a bit longer. */
const SETTLEMENT_DELAY_MS = 10 * MINUTE_MS;

export type ReminderSettings = {
  enabled: boolean;
  /** Local time of the daily reminder. */
  hour: number;
  minute: number;
};

export const defaultReminderSettings: ReminderSettings = { enabled: false, hour: 18, minute: 0 };

export type ReminderChallenge = {
  id: string;
  title: string;
  goalType: GoalType;
  targetValue: number;
  status: string;
  startsAt: string;
  endsAt: string;
  syncGraceHours: number;
};

/** An open training session (see features/training); the reminder is sent at the daily time. */
export type TrainingReminder = { date: string; distanceM: number };

const TRAINING_HORIZON_DAYS = 7;

export type PlannedReminder = {
  /** Stable key, so the same reminder is always the same notification. */
  key: string;
  title: string;
  body: string;
  at: Date;
};

const kmFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Metres left until a run goal, or null if the goal is already reached. */
function remainingMeters(challenge: ReminderChallenge, progress: number): number | null {
  const left = challenge.targetValue - progress;
  return left > 0 ? left : null;
}

function atTime(day: Date, settings: ReminderSettings): Date {
  const result = new Date(day);
  result.setHours(settings.hour, settings.minute, 0, 0);
  return result;
}

/**
 * Plans the local notifications for the signed-in user. Pure: it only decides when and what;
 * it never decides who reached a goal (the server does). `progress` is the last known server
 * value per challenge, so a reminder text can be older than the latest run until the next sync.
 */
export function planReminders(
  challenges: readonly ReminderChallenge[],
  progress: Readonly<Record<string, number>>,
  settings: ReminderSettings,
  now: Date,
  trainingSessions: readonly TrainingReminder[] = [],
): PlannedReminder[] {
  if (!settings.enabled) {
    return [];
  }
  const planned: PlannedReminder[] = [];

  for (const challenge of challenges) {
    const startsAt = new Date(challenge.startsAt);
    const endsAt = new Date(challenge.endsAt);

    if (challenge.status === 'open') {
      const dayBefore = new Date(startsAt.getTime() - 24 * HOUR_MS);
      const at = atTime(dayBefore, settings);
      if (at > now && at < startsAt) {
        planned.push({
          key: `start-${challenge.id}`,
          title: challenge.title,
          body: de.reminders.startsTomorrow,
          at,
        });
      }
    }

    if (['open', 'active', 'settling'].includes(challenge.status)) {
      const settleAt = new Date(
        endsAt.getTime() + challenge.syncGraceHours * HOUR_MS + SETTLEMENT_DELAY_MS,
      );
      if (settleAt > now) {
        planned.push({
          key: `result-${challenge.id}`,
          title: challenge.title,
          body: de.reminders.resultReady,
          at: settleAt,
        });
      }
    }

    if (challenge.status === 'active' || challenge.status === 'open') {
      const value = progress[challenge.id] ?? 0;
      const daily = challenge.goalType === 'steps_daily';
      const stepsInTotal = challenge.goalType === 'steps_total';
      const left = daily ? null : remainingMeters(challenge, value);
      // A reached run or "most steps" goal needs no reminder (the ranking goes on, though).
      if (!daily && left === null) {
        continue;
      }
      const body = daily
        ? de.reminders.stepsOpen(integerFormat.format(challenge.targetValue))
        : stepsInTotal
          ? de.reminders.stepsLeft(integerFormat.format(left ?? 0))
          : de.reminders.kmLeft(kmFormat.format((left ?? 0) / 1000));

      for (let offset = 0; offset < DAILY_HORIZON_DAYS; offset += 1) {
        const day = new Date(now);
        day.setDate(day.getDate() + offset);
        const at = atTime(day, settings);
        // Only while the challenge runs; nothing on days when it has not started or is over.
        if (at > now && at >= startsAt && at < endsAt) {
          planned.push({
            key: `daily-${challenge.id}-${offset}`,
            title: challenge.title,
            body,
            at,
          });
        }
      }
    }
  }

  for (const session of trainingSessions) {
    const [year, month, day] = session.date.split('-').map(Number);
    const at = atTime(new Date(year, month - 1, day), settings);
    if (at > now && at.getTime() - now.getTime() <= TRAINING_HORIZON_DAYS * 24 * HOUR_MS) {
      planned.push({
        key: `training-${session.date}`,
        title: de.training.reminderTitle,
        body: de.training.reminderBody(kmFormat.format(session.distanceM / 1000)),
        at,
      });
    }
  }

  return planned.sort((a, b) => a.at.getTime() - b.at.getTime());
}
