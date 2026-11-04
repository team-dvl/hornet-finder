import api from './api';
import type { BarFamily, PersonSummary } from './hivesApi';
import { newHiveId } from './hivesApi';

/**
 * Visits to the apiaries, see `backend/apiculture/visit_views.py`: when, who
 * came, what was done, and an inspection per colony looked at. The latest
 * visit sets a colony's count of bars; eggs seen in a colony raising a queen
 * record its laying.
 */

export type VisitKind = 'control' | 'feeding' | 'division' | 'swarm_catch' | 'transfer' | 'entrance_guard' | 'other';
export type Temper = '' | 'calm' | 'nervous' | 'aggressive';
export type Activity = '' | 'low' | 'normal' | 'high';
export type Hornets = '' | 'none' | 'few' | 'many';
export type Feeding = '' | 'syrup' | 'candy' | 'other';
export type FeedingUnit = '' | 'l' | 'kg';
export type WeatherSummary = '' | 'clear' | 'mostly_clear' | 'partly_cloudy' | 'overcast' | 'fog' | 'drizzle'
  | 'rain' | 'showers' | 'snow' | 'thunderstorm';

/** The weather of a visit: typed, or filled from Open-Meteo (`source`) */
export interface VisitWeather {
  weather_temperature: string | null;
  weather_precipitation: string | null;
  weather_wind: string | null;
  weather_cloud_cover: number | null;
  weather_summary: WeatherSummary;
  weather_source: '' | 'open-meteo';
}

export interface Inspection {
  id?: number;
  hive: string | null;
  hive_label?: string;
  colony: string | null;
  colony_label?: string;
  compartment?: number;
  bar_family?: BarFamily;
  queen_seen: boolean | null;
  eggs_seen: boolean | null;
  brood_seen: boolean | null;
  queen_cells: boolean | null;
  temper: Temper;
  activity: Activity;
  pollen: boolean | null;
  hornets: Hornets;
  entrance_guard: boolean | null;
  feeding: Feeding;
  feeding_amount: string | null;
  feeding_unit: FeedingUnit;
  bars: number | null;
  notes: string;
}

export interface VisitPhoto {
  id: number;
  inspection: number | null;
  image_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface Visit extends VisitWeather {
  id: string;
  apiary: { id: number; address: string; afsca_number: string } | null;
  /** How the apiary read: all that is left once it is deleted */
  apiary_label: string;
  started_at: string;
  duration_minutes: number | null;
  title: string;
  kinds: VisitKind[];
  report: string;
  guest_names: string;
  created_by: PersonSummary | null;
  participants: PersonSummary[];
  inspections: Inspection[];
  photos: VisitPhoto[];
  created_at: string;
  updated_at: string;
  permissions?: { edit: boolean };
}

export interface VisitValues extends VisitWeather {
  apiary?: number;
  started_at: string;
  duration_minutes: number | null;
  title: string;
  kinds: VisitKind[];
  report: string;
  guest_names: string;
  participants: string[];
  inspections: Inspection[];
}

export interface VisitPage {
  count: number;
  next: string | null;
  results: Visit[];
}

export const KIND_LABELS: Record<VisitKind, string> = {
  control: 'Contrôle',
  feeding: 'Nourrissage',
  division: 'Division',
  swarm_catch: "Récolte d'essaim",
  transfer: 'Transvasement',
  entrance_guard: 'Muselière',
  other: 'Autre',
};

export const WEATHER_LABELS: Record<Exclude<WeatherSummary, ''>, string> = {
  clear: 'Ensoleillé', mostly_clear: 'Plutôt dégagé', partly_cloudy: 'Partiellement nuageux', overcast: 'Couvert',
  fog: 'Brouillard', drizzle: 'Bruine', rain: 'Pluie', showers: 'Averses', snow: 'Neige', thunderstorm: 'Orageux',
};

export const TEMPER_LABELS: Record<Exclude<Temper, ''>, string> = {
  calm: 'Calme', nervous: 'Nerveuse', aggressive: 'Agressive',
};

export const ACTIVITY_LABELS: Record<Exclude<Activity, ''>, string> = {
  low: 'Faible', normal: 'Normale', high: 'Forte',
};

export const HORNET_LABELS: Record<Exclude<Hornets, ''>, string> = {
  none: 'Aucun', few: 'Quelques-uns', many: 'Nombreux',
};

export const FEEDING_LABELS: Record<Exclude<Feeding, ''>, string> = {
  syrup: 'Sirop', candy: 'Candi', other: 'Autre',
};

/** An inspection where nothing was noted yet. */
export function blankInspection(hive: string, colony: string | null, bars: number | null): Inspection {
  return {
    hive, colony, queen_seen: null, eggs_seen: null, brood_seen: null, queen_cells: null, temper: '',
    activity: '', pollen: null, hornets: '', entrance_guard: null, feeding: '', feeding_amount: null,
    feeding_unit: '', bars, notes: '',
  };
}

/** The title of a visit, else its kinds, else "Visite". */
export function visitLabel(visit: Pick<Visit, 'title' | 'kinds'>): string {
  return visit.title || visit.kinds.map((kind) => KIND_LABELS[kind]).join(', ') || 'Visite';
}

export async function fetchVisits(params: { apiary?: number; colony?: string; hive?: string; page?: number } = {}): Promise<VisitPage> {
  return (await api.get('/visits/', { params })).data;
}

export async function fetchVisit(id: string): Promise<Visit> {
  return (await api.get(`/visits/${id}/`)).data;
}

export async function createVisit(values: VisitValues): Promise<Visit> {
  return (await api.post('/visits/', { id: newHiveId(), ...values })).data;
}

export async function updateVisit(id: string, values: Partial<VisitValues>): Promise<Visit> {
  return (await api.patch(`/visits/${id}/`, values)).data;
}

export async function deleteVisit(id: string): Promise<void> {
  await api.delete(`/visits/${id}/`);
}

export async function addVisitPhotos(id: string, files: File[], inspection?: number | null): Promise<Visit> {
  const form = new FormData();
  files.forEach((file) => form.append('photos', file));
  if (inspection) form.append('inspection', String(inspection));
  return (await api.post(`/visits/${id}/photos/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
}

export async function deleteVisitPhoto(id: string, photo: number): Promise<Visit> {
  return (await api.delete(`/visits/${id}/photos/${photo}/`)).data;
}

export interface ParticipantChoices {
  groups: { path: string; name: string }[];
  members?: { guid: string; name: string | null }[];
}

export async function fetchParticipantChoices(groupPath?: string): Promise<ParticipantChoices> {
  return (await api.get('/visits/participants/', { params: groupPath ? { group_path: groupPath } : {} })).data;
}

/** `datetime-local` value of an ISO date, in local time. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The apiaries the user sees (their own and those shared with them), to record a visit in. */
export async function fetchVisitableApiaries(isAdmin: boolean): Promise<{ id: number; label: string }[]> {
  const scopes = isAdmin ? ['all'] : ['mine', 'shared'];
  const pages = await Promise.all(scopes.map((scope) => api.get('/apiaries/managed/', {
    params: { scope, ordering: 'address', page_size: 200 },
  })));
  const seen = new Set<number>();
  const result: { id: number; label: string }[] = [];
  for (const page of pages) {
    for (const apiary of page.data.results as { id: number; address?: string; host_name?: string }[]) {
      if (seen.has(apiary.id)) continue;
      seen.add(apiary.id);
      const place = apiary.address || `Rucher #${apiary.id}`;
      result.push({ id: apiary.id, label: apiary.host_name ? `${place} (${apiary.host_name})` : place });
    }
  }
  return result;
}

/** What was seen of a colony, in a few words, for a sheet or a list. */
export function inspectionSummary(inspection: Inspection): string[] {
  const parts: string[] = [];
  const yes = (value: boolean | null, label: string, no: string) => {
    if (value === true) parts.push(label);
    else if (value === false) parts.push(no);
  };
  yes(inspection.queen_seen, 'reine vue', 'reine non vue');
  yes(inspection.eggs_seen, 'œufs', "pas d'œufs");
  yes(inspection.brood_seen, 'couvain', 'pas de couvain');
  yes(inspection.queen_cells, 'cellules royales', '');
  if (inspection.temper) parts.push(TEMPER_LABELS[inspection.temper].toLowerCase());
  if (inspection.activity) parts.push(`activité ${ACTIVITY_LABELS[inspection.activity].toLowerCase()}`);
  yes(inspection.pollen, 'pollen', 'pas de pollen');
  if (inspection.hornets) parts.push(`frelons : ${HORNET_LABELS[inspection.hornets].toLowerCase()}`);
  yes(inspection.entrance_guard, 'muselière', 'sans muselière');
  if (inspection.feeding) {
    const amount = inspection.feeding_amount ? ` ${Number(inspection.feeding_amount).toLocaleString('fr-BE')} ${inspection.feeding_unit === 'kg' ? 'kg' : 'L'}` : '';
    parts.push(`${FEEDING_LABELS[inspection.feeding].toLowerCase()}${amount}`);
  }
  if (inspection.bars !== null) parts.push(`${inspection.bars} ${inspection.bar_family === 'warre' ? 'éléments' : 'barrettes'}`);
  return parts.filter(Boolean);
}

export interface FetchedWeather {
  temperature: number | null;
  precipitation: number | null;
  wind: number | null;
  cloud_cover: number | null;
  summary: WeatherSummary;
  /** The hour the values are of (UTC, ISO) */
  hour: string;
}

/** The weather at the apiary at the hour of the visit, from Open-Meteo (asked by the server). */
export async function fetchWeather(apiary: number, at: string): Promise<FetchedWeather> {
  return (await api.get('/visits/weather/', { params: { apiary, at } })).data;
}

/** The weather of a visit in one line: « 17 °C · Orageux · vent 12 km/h · nuages 40 % · 1,2 mm ». */
export function weatherLine(visit: VisitWeather): string {
  const number = (value: string | number) => Number(value).toLocaleString('fr-BE', { maximumFractionDigits: 1 });
  return [
    visit.weather_temperature !== null && `${number(visit.weather_temperature)} °C`,
    visit.weather_summary && WEATHER_LABELS[visit.weather_summary],
    visit.weather_wind !== null && `vent ${number(visit.weather_wind)} km/h`,
    visit.weather_cloud_cover !== null && `nuages ${visit.weather_cloud_cover} %`,
    visit.weather_precipitation !== null && `${number(visit.weather_precipitation)} mm`,
  ].filter(Boolean).join(' · ');
}
