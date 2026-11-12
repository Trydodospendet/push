/**
 * Calendar-date helpers. A "local date" is a 'YYYY-MM-DD' string for a day in a given
 * timezone; arithmetic on it happens in UTC so that daylight saving time never shifts a day.
 */

/** The local calendar date of an instant in the given timezone, e.g. '2026-11-14'. */
export function toLocalDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: string, days: number): string {
  const result = parseLocalDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both local dates). */
export function daysBetween(from: string, to: string): number {
  const millisPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / millisPerDay);
}

const dayLabelFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'UTC',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** e.g. 'Fr., 14.11.' */
export function formatDayLabel(date: string): string {
  return dayLabelFormat.format(parseLocalDate(date));
}

const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

/** e.g. '14.11.2026, 09:30' in the given timezone. */
export function formatDateTime(instant: Date, timeZone: string): string {
  let format = dateTimeFormatCache.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('de-DE', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    dateTimeFormatCache.set(timeZone, format);
  }
  return format.format(instant);
}
