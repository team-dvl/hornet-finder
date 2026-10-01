/**
 * Parameters of a statistic as they live in the page URL, and the labels and
 * number formats of the statistics pages.
 */
import type { StatParams } from '../../utils/statsApi';

const LOCALE = 'fr-BE';

/** Keys the URL may carry; the same names as the API's */
export const PARAM_KEYS = [
  'period', 'season', 'year', 'from', 'to', 'granularity', 'compare',
  'trap_type', 'group', 'mine', 'lat', 'lon', 'radius', 'reach', 'bandwidth', 'grid', 'order',
] as const;

export const PERIOD_OPTIONS = [
  { value: 'd7', label: '7 derniers jours' },
  { value: 'd30', label: '30 derniers jours' },
  { value: 'month', label: 'Mois en cours' },
  { value: 'season', label: 'Saison' },
  { value: 'year', label: 'Année' },
  { value: 'custom', label: 'Dates libres' },
];

export const SEASON_OPTIONS = [
  { value: 'spring', label: 'Printemps (1 févr. – 15 juin)' },
  { value: 'summer', label: 'Été (16 juin – 30 sept.)' },
  { value: 'late', label: 'Été-automne-hiver (16 juin – 31 déc.)' },
];

export const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Jour', chip: 'Par jour' },
  { value: 'week', label: 'Semaine', chip: 'Par semaine' },
  { value: 'month', label: 'Mois', chip: 'Par mois' },
];

export const ORDER_OPTIONS = [
  { value: 'rate', label: 'Par semaine', chip: 'Classés par semaine' },
  { value: 'hornets', label: 'Captures', chip: 'Classés par captures' },
];

export const RADIUS_OPTIONS = [1, 2, 5, 10];

/** Years offered: the current one and the four before */
export function yearOptions(today = new Date()): string[] {
  return Array.from({ length: 5 }, (_, index) => String(today.getFullYear() - index));
}

/** The season the given day falls in, or null in January (no season). */
export function currentSeason(today = new Date()): string | null {
  const day = (today.getMonth() + 1) * 100 + today.getDate();
  if (day >= 201 && day <= 615) return 'spring';
  if (day >= 616 && day <= 930) return 'summer';
  if (day >= 1001) return 'late';
  return null;
}

/** Last day of a season (or of the year for `year`) */
export function periodEnd(period: string, year: number): Date {
  if (period === 'spring') return new Date(year, 5, 15);
  if (period === 'summer') return new Date(year, 8, 30);
  return new Date(year, 11, 31);
}

/** The parameters of the page: the URL's, completed with the defaults. */
export function readParams(search: URLSearchParams): StatParams {
  const params: StatParams = {};
  PARAM_KEYS.forEach((key) => {
    const value = search.get(key);
    if (value) params[key] = value;
  });
  if (!params.period) {
    // The season under way; in January, the year
    const season = currentSeason();
    params.period = season ? 'season' : 'year';
    if (season && !params.season) params.season = season;
  }
  if (params.period === 'season' && !params.season) params.season = 'spring';
  if ((params.period === 'season' || params.period === 'year') && !params.year) {
    params.year = String(new Date().getFullYear());
  }
  return params;
}

/** The URL search string of `params`, dropping what does not apply. */
export function writeParams(params: StatParams): string {
  const search = new URLSearchParams();
  PARAM_KEYS.forEach((key) => {
    const value = params[key];
    if (!value) return;
    if ((key === 'season') && params.period !== 'season') return;
    if (key === 'year' && params.period !== 'season' && params.period !== 'year') return;
    if ((key === 'from' || key === 'to') && params.period !== 'custom') return;
    search.set(key, value);
  });
  return search.toString();
}

/** 12, 12,5, 1 234: a count spread over time is rarely whole */
export function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–';
  const number = Number(value);
  const whole = Math.abs(number - Math.round(number)) < 0.05;
  return number.toLocaleString(LOCALE, { maximumFractionDigits: whole ? 0 : 1, minimumFractionDigits: whole ? 0 : 1 });
}

/** 0,32 */
export function formatRate(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–';
  return Number(value).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 58 % */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–';
  return `${Math.round(Number(value) * 100)} %`;
}

/** Keycloak paths the user may filter on: their groups, `admin` subgroups folded into the group. */
export function filterableGroups(membership: string[]): { path: string; label: string }[] {
  const paths = new Set<string>();
  membership.forEach((path) => {
    const segments = path.split('/');
    const index = segments.indexOf('admin', 1);
    paths.add(index > 0 ? segments.slice(0, index).join('/') : path);
  });
  return [...paths].filter(Boolean).sort().map((path) => ({ path, label: path.split('/').pop() || path }));
}

/** Statistics parameters of the period picked in the map's layers sheet. */
export function analysisParams(period: string, year: number): Record<string, string> {
  return period === 'year'
    ? { period: 'year', year: String(year) }
    : { period: 'season', season: period, year: String(year) };
}
