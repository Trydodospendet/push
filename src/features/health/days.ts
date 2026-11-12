import { addDays, toLocalDate } from '@/lib/dates';

/** Midnight in the profile timezone, independent of the phone's current travel timezone. */
export function dayStart(date: string, timezone: string): Date {
  const target = Date.parse(`${date}T00:00:00Z`);
  let guess = target;
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const parts = format.formatToParts(new Date(guess));
    const n = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);
    const rendered = Date.UTC(
      n('year'),
      n('month') - 1,
      n('day'),
      n('hour'),
      n('minute'),
      n('second'),
    );
    const adjustment = target - rendered;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(guess);
}

export function healthDays(timezone: string, now: Date, earliest?: Date) {
  const today = toLocalDate(now, timezone);
  return Array.from({ length: 45 }, (_, i) => {
    const date = addDays(today, i - 44);
    return {
      date,
      start: dayStart(date, timezone),
      end: new Date(Math.min(dayStart(addDays(date, 1), timezone).getTime(), now.getTime())),
    };
  }).filter((day) => !earliest || day.start >= earliest);
}

type OriginRecord = { metadata?: { dataOrigin?: string; recordingMethod?: number } };

/** Never sum source totals. Pass the complete eligible set to ONE aggregate request. */
export function eligibleOrigins(records: OriginRecord[]) {
  const all = new Set<string>();
  const excluded = new Set<string>();
  for (const record of records) {
    const origin = record.metadata?.dataOrigin;
    // Without provenance we cannot prove that an aggregate excludes a manual record.
    if (!origin) throw new Error('health_missing_origin');
    all.add(origin);
    if (record.metadata?.recordingMethod === 3) excluded.add(origin);
  }
  return { origins: [...all].filter((origin) => !excluded.has(origin)), excluded: excluded.size };
}
