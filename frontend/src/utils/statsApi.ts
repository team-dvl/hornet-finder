/** Client of the statistics API (`/api/stats/`). */
import api from './api';
import { getAxiosErrorMessage } from './axiosTypes';

export type StatParams = Record<string, string>;

export interface StatDescription {
  id: string;
  title: string;
  description: string;
  /** `table`: rows over time or by group; `map`: cells of a 250 m grid */
  kind: 'table' | 'map';
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

/** Properties of a grid cell: `covered` (share, coverage) or `rate` (pressure) */
export interface GridCellProperties {
  id: string;
  covered?: number;
  traps?: number;
  rate?: number;
  level?: number;
  effort?: number;
  hornets?: number;
}

export interface GridFeature {
  type: 'Feature';
  geometry: GeoJSON.Geometry;
  properties: GridCellProperties;
}

/** A map statistic: the table fields (for the exports) plus the grid. */
export interface MapStatResult extends StatResult {
  kind: 'map';
  area: { kind: 'zone' | 'bbox'; km2: number };
  /** [lat, lon] of the traps in service near the area */
  traps: [number, number][];
  parameters: { reach?: number; bandwidth?: number; cell: number; min_effort_days?: number };
  summary: {
    coverage?: number | null;
    covered_km2?: number;
    density?: number | null;
    traps: number;
    rate?: number | null;
    rate_low?: number | null;
    rate_high?: number | null;
    hornets?: number;
    trap_days?: number;
  };
  /** Class limits of the pressure (Asian hornets per trap and per week) */
  bins?: number[];
  cells: { type: 'FeatureCollection'; features: GridFeature[] };
}

export class StatsError extends Error {
  /** HTTP status: 422 when the area is too large to draw */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface ExportLink {
  url: string;
  filename: string;
  /** Seconds the link stays valid */
  expires_in: number;
}

export type ExportFormat = 'xlsx' | 'csv';

/** The server's own message (`{error}`), else the generic one. */
function fail(error: unknown): never {
  const response = (error as { response?: { status?: number; data?: { error?: string } } }).response;
  throw new StatsError(response?.data?.error || getAxiosErrorMessage(error), response?.status);
}

export async function fetchStatCatalogue(): Promise<StatDescription[]> {
  try {
    return (await api.get('/stats/')).data;
  } catch (error) {
    fail(error);
  }
}

export async function fetchStat<T extends StatResult = StatResult>(id: string, params: StatParams): Promise<T> {
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
