/**
 * Money display for the Analytics Studio. An OFFERED county is never shown as "$0" — a sub-$1
 * premium (low payout × high trigger) reads "<$1", upholding the QC panel's "never $0" claim
 * without touching the price itself.
 */
export function money(n: number): string {
  if (n >= 1) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (n > 0) return "<$1";
  return "$0";
}
