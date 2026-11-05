import api from './api';
import type { BarFamily, PersonSummary } from './hivesApi';
import { fetchApiaryChoices, newHiveId, type ApiaryChoice } from './hivesApi';

/**
 * Visits to the apiaries, see `backend/apiculture/visit_views.py`: when, who
 * came, what was done, and an inspection per colony looked at. The latest
 * visit sets a colony's count of bars; eggs seen in a colony raising a queen
 * record its laying.
 */

/** What a planned visit follows up: the move out of a nucleus, or the check that a new queen lays */
export type FollowUp = 'nucleus_transfer' | 'laying_check';

/** A follow-up visit the server proposes after an event of a colony */
export interface FollowUpProposal {
  follow_up: FollowUp;
  colony: string;
  colony_label: string;
  hive: string;
  hive_label: string;
  apiary: number;
  /** ISO date-time: nucleus + 3 days at 7:30, laying + 25 days at 11:00, tomorrow at the earliest */
  suggested_at: string;
}

export const FOLLOW_UP_LABELS: Record<FollowUp, string> = {
  nucleus_transfer: 'Transvasement',
  laying_check: 'Contrôle de ponte',
};

/** Planned, then done once it took place (never back) */
export type VisitStatus = 'planned' | 'done';

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
  status: VisitStatus;
  follow_up: FollowUp | '';
  follow_up_colony: {
    id: string; label: string; ended: boolean; hive: string | null; hive_label: string;
    in_nucleus: boolean; bars: number | null;
  } | null;
  apiary: { id: number; name: string; address: string; afsca_number: string } | null;
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
  status: VisitStatus;
  follow_up?: FollowUp;
  follow_up_colony?: string;
  /** Doing a nucleus follow-up: where its colony goes */
  transfer?: { hive: string; compartment: 1 | 2; bars?: number | null };
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

/** Where a planned visit stands, from the local day: late, today, tomorrow, or later (null). */
export function plannedWhen(visit: Pick<Visit, 'status' | 'started_at'>, now = new Date()): 'late' | 'today' | 'tomorrow' | null {
  if (visit.status !== 'planned') return null;
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((day(new Date(visit.started_at)) - day(now)) / 86_400_000);
  if (days < 0) return 'late';
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : null;
}

export const PLANNED_WHEN_LABELS = { late: 'En retard', today: "Aujourd'hui", tomorrow: 'Demain' } as const;

/** The title of a visit, else its kinds, else "Visite". */
export function visitLabel(visit: Pick<Visit, 'title' | 'kinds'>): string {
  return visit.title || visit.kinds.map((kind) => KIND_LABELS[kind]).join(', ') || 'Visite';
}

export async function fetchVisits(params: {
  apiary?: number; colony?: string; hive?: string; page?: number;
  /** 'done' by default (the journal, newest first); 'planned' soonest first */
  status?: VisitStatus | 'all';
  /** Local days, included (the calendar): soonest first */
  from?: string; to?: string;
  page_size?: number;
} = {}): Promise<VisitPage> {
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
export function fetchVisitableApiaries(isAdmin: boolean): Promise<ApiaryChoice[]> {
  return fetchApiaryChoices(isAdmin);
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

/** Plan the follow-up visit of a proposal, at `at` (ISO), with `participant` (the user). */
export async function planFollowUp(proposal: FollowUpProposal, at: string, participant: string | null): Promise<Visit> {
  return createVisit({
    status: 'planned', apiary: proposal.apiary, started_at: at, duration_minutes: null,
    title: `${FOLLOW_UP_LABELS[proposal.follow_up]} · ${proposal.colony_label}`.slice(0, 120),
    kinds: proposal.follow_up === 'nucleus_transfer' ? ['transfer'] : ['control'],
    report: '', guest_names: '', participants: participant ? [participant] : [],
    inspections: [blankInspection(proposal.hive, proposal.colony, null)],
    follow_up: proposal.follow_up, follow_up_colony: proposal.colony,
    weather_temperature: null, weather_precipitation: null, weather_wind: null, weather_cloud_cover: null,
    weather_summary: '', weather_source: '',
  });
}
