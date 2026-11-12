import { de } from '@/i18n/de';

const amountFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an amount in cents for display, e.g. 10000 → "100,00".
 * Display only: never use the result for calculations.
 */
export function formatAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Amounts must be whole cents, got ${cents}.`);
  }
  return amountFormat.format(cents / 100);
}

/** Formats an amount in cents as virtual credits, e.g. 10000 → "100,00 Credits". */
export function formatCredits(cents: number): string {
  return `${formatAmount(cents)} ${de.common.credits}`;
}
