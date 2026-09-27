/** Client of the statistics API (`/api/stats/`). */
import api from './api';
import { getAxiosErrorMessage } from './axiosTypes';

export type StatParams = Record<string, string>;

export interface StatDescription {
  id: string;
  title: string;
  description: string;
  /** Parameters the page offers: period, granularity, compare, trap_type, group, mine, zone */
  filters: string[];
}

export interface StatColumn {
  key: string;
  label: string;
  type: 'text' | 'date' | 'int' | 'float' | 'percent';
  decimals?: number;
}

export interface StatPeriod {
  key: string;
  label: string;
  /** `1 févr. – 15 juin 2026` */
  dates: string;
  start: string;
  end: string;
  season: string | null;
  year: number | null;
}

export type StatRow = Record<string, string | number | null>;

export interface StatResult {
  statistic: { id: string; title: string };
  period: StatPeriod;
  previous: StatPeriod | null;
  granularity: 'day' | 'week' | 'month' | null;
  filters: string[];
  /** `all`: every trap counted; `visible`: only the traps the user sees on the map */
  scope: { kind: 'all' | 'visible'; label: string; traps: number };
  columns: StatColumn[];
  rows: StatRow[];
  totals: StatRow;
  warnings: string[];
  computed_at: string;
}

export interface ExportLink {
  url: string;
  filename: string;
  /** Seconds the link stays valid */
  expires_in: number;
}

export type ExportFormat = 'xlsx' | 'csv';

export class StatsError extends Error {}

/** The server's own message (`{error}`), else the generic one. */
function fail(error: unknown): never {
  const data = (error as { response?: { data?: { error?: string } } }).response?.data;
  throw new StatsError(data?.error || getAxiosErrorMessage(error));
}

export async function fetchStatCatalogue(): Promise<StatDescription[]> {
  try {
    return (await api.get('/stats/')).data;
  } catch (error) {
    fail(error);
  }
}

export async function fetchStat(id: string, params: StatParams): Promise<StatResult> {
  try {
    return (await api.get(`/stats/${id}/`, { params })).data;
  } catch (error) {
    fail(error);
  }
}

export async function fetchExportLink(id: string, format: ExportFormat, params: StatParams): Promise<ExportLink> {
  try {
    return (await api.post(`/stats/${id}/export/`, { format, params })).data;
  } catch (error) {
    fail(error);
  }
}
