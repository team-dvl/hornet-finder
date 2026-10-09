/** Helpers of the trap manager list. */

/** Days after which a trap in service is shown as waiting for a visit */
export const OVERDUE_DAYS = 7;

/**
 * Calendar days (local time) between `iso` and `now`, or null when there is no date.
 * Midnight-based, not 24 h slices: a visit at 19:00 yesterday is "yesterday" at 09:00 today.
 */
export function daysSince(iso?: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const startOfDay = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  // UTC-based day numbers: exact whole days, immune to DST (23 h / 25 h local days)
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(new Date(iso).getTime())) / 86_400_000));
}
