const kmFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pad = (value: number) => String(value).padStart(2, '0');

/** '1:05:09' or '12:30'. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}`
    : `${minutes}:${pad(seconds % 60)}`;
}

/** '5:33' per kilometre; '–:––' while the pace is unknown or absurd (over 59:59). */
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm >= 3600) {
    return '–:––';
  }
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** '3,60' (kilometres). */
export function formatKm(distanceM: number): string {
  return kmFormat.format(distanceM / 1000);
}
