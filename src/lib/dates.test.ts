import { addDays, daysBetween, formatDateTime, formatDayLabel, toLocalDate } from './dates';

describe('toLocalDate', () => {
  it('uses the calendar day of the given timezone', () => {
    // 23:30 UTC is already the next day in Berlin (UTC+1 in November).
    const instant = new Date('2026-11-13T23:30:00Z');
    expect(toLocalDate(instant, 'Europe/Berlin')).toBe('2026-11-14');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-11-13');
  });
});

describe('addDays / daysBetween', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is not affected by daylight saving time', () => {
    // Berlin switches to summer time on 2027-03-28.
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(daysBetween('2027-03-20', '2027-04-03')).toBe(14);
  });
});

describe('formatting', () => {
  it('formats a short German day label', () => {
    expect(formatDayLabel('2026-11-14')).toBe('Sa., 14.11.');
  });

  it('formats date and time in the given timezone', () => {
    expect(formatDateTime(new Date('2026-11-12T11:05:00Z'), 'Europe/Berlin')).toBe(
      '12.11.2026, 12:05',
    );
  });
});
