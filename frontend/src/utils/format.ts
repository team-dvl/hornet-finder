/** Dates and durations as shown in the application (Belgian French). */

const LOCALE = 'fr-BE';

type DateInput = string | number | Date;

/** 22 sept. 2026 */
export const formatDate = (value: DateInput) =>
  new Date(value).toLocaleDateString(LOCALE, { dateStyle: 'medium' });

/** 22 sept. 2026, 14:05 */
export const formatDateTime = (value: DateInput) =>
  new Date(value).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

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
