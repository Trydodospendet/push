/** Pushy sleeps at night, from ten in the evening until six in the morning. */
export function isNight(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

/**
 * Counts how often the finger changed its horizontal direction (by at least `minStep` points).
 * Wiggling Pushy back and forth makes him dizzy.
 */
export function countReversals(xs: readonly number[], minStep: number): number {
  let reversals = 0;
  let direction = 0;
  let anchor = xs[0] ?? 0;
  for (const x of xs) {
    const delta = x - anchor;
    if (Math.abs(delta) < minStep) continue;
    const next = delta > 0 ? 1 : -1;
    if (direction !== 0 && next !== direction) reversals += 1;
    direction = next;
    anchor = x;
  }
  return reversals;
}

/** Which side edge Pushy snaps to, so he never rests on top of the buttons in the middle. */
export function snapX(x: number, width: number, boxWidth: number, margin: number): number {
  return x + boxWidth / 2 < width / 2 ? margin : width - boxWidth - margin;
}
