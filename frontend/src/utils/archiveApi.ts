/** Client of the archiving endpoints of the nests and hornet sightings. */
import api from './api';
import { getAxiosErrorMessage } from './axiosTypes';
import { SEASON_OPTIONS, periodEnd } from '../components/stats/statParams';

/** The project started in 2025: nothing to archive before */
export const ARCHIVE_FIRST_YEAR = 2025;

export type ArchiveKind = 'hornets' | 'nests';

/** A season of the statistics filters (or the whole year) of a year */
export interface ArchivePeriod {
  /** `spring`, `summer`, `late` or `year` */
  period: string;
  year: number;
}

export interface ArchiveChoice extends ArchivePeriod {
  /** `spring-2026` */
  id: string;
  /** `Printemps 2026` */
  label: string;
  /** `1 févr. – 15 juin` */
  dates: string;
}

const PERIODS = [
  ...SEASON_OPTIONS.map(({ value, label }) => {
    const [, name, dates] = label.match(/^(.*) \((.*)\)$/) ?? [label, label, ''];
    return { value, name, dates };
  }),
  { value: 'year', name: 'Année', dates: '1 janv. – 31 déc.' },
];

/** The periods that are over, most recent first: only those can be archived. */
export function archiveChoices(today = new Date()): ArchiveChoice[] {
  const choices: ArchiveChoice[] = [];
  for (let year = today.getFullYear(); year >= ARCHIVE_FIRST_YEAR; year--) {
    [...PERIODS].reverse().forEach(({ value, name, dates }) => {
      if (periodEnd(value, year) < today) {
        choices.push({ id: `${value}-${year}`, period: value, year, label: `${name} ${year}`, dates });
      }
    });
  }
  return choices;
}

function query({ period, year }: ArchivePeriod): string {
  return period === 'year'
    ? `period=year&year=${year}`
    : `period=season&season=${period}&year=${year}`;
}

/** The server's own message (`{error}`), else the generic one. */
function fail(error: unknown): never {
  const data = (error as { response?: { data?: { error?: string } } }).response?.data;
  throw new Error(data?.error || getAxiosErrorMessage(error));
}

/** How many objects archiving `period` would archive. */
export async function fetchArchiveCandidates(kind: ArchiveKind, period: ArchivePeriod): Promise<number> {
  try {
    return (await api.get<{ count: number }>(`/${kind}/archive_candidates/?${query(period)}`)).data.count;
  } catch (error) {
    fail(error);
  }
}

/** Archives the objects of `period`; the number archived. */
export async function bulkArchive(kind: ArchiveKind, period: ArchivePeriod): Promise<number> {
  try {
    return (await api.post<{ archived_count: number }>(`/${kind}/bulk_archive/?${query(period)}`, {})).data.archived_count;
  } catch (error) {
    fail(error);
  }
}
