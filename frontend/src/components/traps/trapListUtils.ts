/** Helpers of the trap manager list. */

/** Days after which a trap in service is shown as waiting for a visit */
export const OVERDUE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days elapsed since `iso`, or null when there is no date. */
export function daysSince(iso?: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

/** Great-circle distance in km (haversine); good to well under 1 % at this scale. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
