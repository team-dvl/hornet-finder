/** Dates and durations as shown in the application (Belgian French). */

const LOCALE = 'fr-BE';

type DateInput = string | number | Date;

/** 22 sept. 2026 */
export const formatDate = (value: DateInput) =>
  new Date(value).toLocaleDateString(LOCALE, { dateStyle: 'medium' });

/** 22 sept. 2026, 14:05 */
export const formatDateTime = (value: DateInput) =>
  new Date(value).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

/** 14:05 */
export const formatTime = (value: DateInput) =>
  new Date(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** 22/09/26 14:05, for dense lists such as a journal */
export const formatShortDateTime = (value: DateInput) =>
  new Date(value).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });

/** 45 s, 5 min, 2 min 30 s */
export function formatDuration(seconds?: number | null): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

/** 850 m, 1,2 km */
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} km`;
}

/** Local calendar day of a date, as a `date` input expects it (2026-09-22) */
export function toDateInputValue(value: DateInput = new Date()): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * ISO datetime of a day picked in a `date` input: now for today, noon (local)
 * for a past day, so the day stays the same whatever the time zone.
 */
export function dateInputToIso(day: string): string {
  if (day === toDateInputValue()) return new Date().toISOString();
  return new Date(`${day}T12:00:00`).toISOString();
}
