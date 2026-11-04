import api from './api';
import type { AxiosErrorResponse } from './axiosTypes';

/**
 * Hives and hive types, see `backend/apiculture/views.py`. A hive in service
 * stands in an apiary; stored or retired, it stands nowhere. Moves and changes
 * of keeper are kept as dated periods, listed in the detail.
 */

export type BarFamily = '' | 'topbar' | 'warre';

export interface HiveType {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  bar_family: BarFamily;
  max_bars: number | null;
  bars_per_box: number | null;
  max_colonies: number;
  /** A small hive to carry a colony between two hives (nucleus) */
  portable: boolean;
  hive_count?: number;
}

export type HiveTypeValues = Omit<HiveType, 'id' | 'slug' | 'hive_count'>;

export type HiveStatus = 'active' | 'stored' | 'retired';

export interface ApiarySummary {
  id: number;
  address: string;
  afsca_number: string;
}

export interface PersonSummary {
  guid: string;
  display_name: string;
}

export type HiveOwner =
  | { kind: 'group'; path: string; name: string }
  | ({ kind: 'user' } & PersonSummary);

export interface HivePlacement {
  apiary: ApiarySummary | null;
  /** How the apiary read at the time: all that is left once it is deleted */
  apiary_label: string;
  started_on: string;
  ended_on: string | null;
}

export interface HiveCustody {
  keeper: PersonSummary | null;
  started_on: string;
  ended_on: string | null;
}

export interface Hive {
  id: string;
  hive_type: number;
  hive_type_name: string;
  name: string;
  number: string;
  status: HiveStatus;
  commissioned_on: string | null;
  comments: string;
  created_at: string;
  updated_at: string;
  apiary: ApiarySummary | null;
  owner: HiveOwner | null;
  keeper: PersonSummary | null;
  permissions?: { edit: boolean; move: boolean; manage: boolean };
  /** From the hive type: what the hive holds */
  bar_family: BarFamily;
  max_bars: number | null;
  bars_per_box: number | null;
  max_colonies: number;
  portable: boolean;
  /** Position of the divider (it takes a bar's place); null without one */
  divider_bar: number | null;
  /** The living colonies, by compartment */
  colonies: ColonySummary[];
  /** Detail only */
  placements?: HivePlacement[];
  custodies?: HiveCustody[];
}

export type ColonyOrigin = 'division' | 'swarm_parent' | 'swarm_caught' | 'package' | 'unknown';

export interface ColonySummary {
  id: string;
  name: string;
  origin: ColonyOrigin;
  compartment: 1 | 2;
  /** Top bar: bars; Warré: boxes; null when not counted */
  bars: number | null;
  started_on: string;
  ended_on: string | null;
  requeening_since: string | null;
  laying_since: string | null;
  /** Since when a living colony lives in its hive (its current stay) */
  in_hive_since: string | null;
}

export interface HiveValues {
  hive_type: number;
  name: string;
  number: string;
  commissioned_on: string | null;
  comments: string;
}

export interface NewHiveValues extends HiveValues {
  /** Where it stands; none: stored */
  apiary: number | null;
  placed_on?: string;
  /** Owning association; none: the creator */
  owner_group?: string;
}

export interface HiveQuery {
  apiary?: number;
  /** Default: every hive but the retired ones */
  status?: HiveStatus | 'all';
  q?: string;
}

export const HIVE_STATUS_LABELS: Record<HiveStatus, string> = {
  active: 'En service',
  stored: 'Remisée',
  retired: 'Réformée',
};

export const BAR_FAMILY_LABELS: Record<BarFamily, string> = {
  topbar: 'Barrettes horizontales (TBH, Chandler, nucleus)',
  warre: 'Barrettes Warré',
  '': 'Sans barrette',
};

/** Name and number, as a hive is recognised. */
export function hiveLabel(hive: Pick<Hive, 'name' | 'number'>): string {
  return hive.number ? `${hive.name} #${hive.number}` : hive.name;
}

/** A new identifier, chosen here so a creation sent twice is not made twice. */
export function newHiveId(): string {
  return crypto.randomUUID();
}

export async function fetchHives(query: HiveQuery = {}): Promise<Hive[]> {
  return (await api.get('/hives/', { params: query })).data;
}

export async function fetchHive(id: string): Promise<Hive> {
  return (await api.get(`/hives/${id}/`)).data;
}

export async function createHive(values: NewHiveValues): Promise<Hive> {
  return (await api.post('/hives/', { id: newHiveId(), ...values })).data;
}

export async function updateHive(id: string, values: Partial<HiveValues>): Promise<Hive> {
  return (await api.patch(`/hives/${id}/`, values)).data;
}

export async function deleteHive(id: string): Promise<void> {
  await api.delete(`/hives/${id}/`);
}

export async function moveHive(id: string, apiary: number, on: string): Promise<Hive> {
  return (await api.post(`/hives/${id}/move/`, { apiary, on })).data;
}

export async function storeHive(id: string, on: string): Promise<Hive> {
  return (await api.post(`/hives/${id}/store/`, { on })).data;
}

export async function retireHive(id: string, on: string): Promise<Hive> {
  return (await api.post(`/hives/${id}/retire/`, { on })).data;
}

export interface KeeperChoices {
  groups: { path: string; name: string }[];
  keeper_guid: string | null;
  members?: { guid: string; name: string | null }[];
}

export async function fetchKeeperChoices(id: string, groupPath?: string): Promise<KeeperChoices> {
  return (await api.get(`/hives/${id}/keeper/`, { params: groupPath ? { group_path: groupPath } : {} })).data;
}

export async function setKeeper(id: string, keeperGuid: string, groupPath: string | null, on: string): Promise<Hive> {
  return (await api.put(`/hives/${id}/keeper/`, {
    keeper_guid: keeperGuid, ...(groupPath ? { group_path: groupPath } : {}), on,
  })).data;
}

export async function fetchHiveTypes(): Promise<HiveType[]> {
  return (await api.get('/hive-types/')).data;
}

export async function saveHiveType(id: number | null, values: HiveTypeValues): Promise<HiveType> {
  return id === null
    ? (await api.post('/hive-types/', values)).data
    : (await api.patch(`/hive-types/${id}/`, values)).data;
}

export async function deleteHiveType(id: number): Promise<void> {
  await api.delete(`/hive-types/${id}/`);
}

/** Today, as the server reads a day (`YYYY-MM-DD`, local time). */
export function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The server's messages a user may meet, in French
const MESSAGES: [RegExp, string | ((match: RegExpMatchArray) => string)][] = [
  [/No weather from Open-Meteo/, "Open-Meteo n'a pas de météo pour cette heure : saisissez-la."],
  [/has taken place: not in the future/, 'Une visite enregistrée ici a eu lieu : pas dans le futur.'],
  [/does not stand in this apiary/, "Une des ruches n'est pas dans ce rucher."],
  [/inspected once per visit/, 'Une colonie ne figure qu\'une fois par visite.'],
  [/Only members of your associations/, 'Seuls des membres de vos associations peuvent participer.'],
  [/cannot record a visit/, 'Vous ne pouvez pas enregistrer de visite dans ce rucher.'],
  [/does not live in this hive/, "Cette colonie ne vit pas dans cette ruche."],
  [/Only a hive split by a divider has a second compartment/, 'Le compartiment 2 demande une cloison.'],
  [/already holds a colony/, 'Ce compartiment abrite déjà une colonie.'],
  [/This hive has no bars/, "Cette ruche n'a pas de barrettes."],
  [/At most (\d+) bars in this compartment/, (m) => `Au plus ${m[1]} barrettes dans ce compartiment.`],
  [/takes no divider/, 'Cette ruche ne prend pas de cloison.'],
  [/^Between 2 and (\d+)/, (m) => `La cloison se place entre la barrette 2 et la barrette ${m[1]}.`],
  [/Two colonies live on either side/, 'Deux colonies vivent de part et d\'autre de la cloison.'],
  [/no room for them/, 'Les barrettes d\'une colonie ne tiendraient plus dans son compartiment.'],
  [/^The colony has (\d+) bars/, (m) => `La colonie n'a que ${m[1]} barrettes.`],
  [/This colony has ended/, "Cette colonie n'existe plus."],
  [/A colony lives in this hive/, "Une colonie vit dans cette ruche : transférez-la ou enregistrez sa fin d'abord."],
  [/has held colonies/, 'Cette ruche a abrité des colonies : réformez-la plutôt.'],
  [/already lives there/, 'La colonie est déjà là.'],
  [/living colony you tend/, 'Choisissez une colonie vivante dont vous vous occupez.'],
  [/not raising a queen/, "Cette colonie n'élève pas de reine."],
  [/Before the colony started/, 'Cette date précède le début de la colonie.'],
  [/This hive is not in service/, "Cette ruche n'est pas en service : installez-la d'abord dans un rucher."],
  [/Unknown hive/, 'Ruche introuvable.'],
  [/cannot put a colony in this hive/, 'Vous ne pouvez pas mettre de colonie dans cette ruche.'],
  [/origin of a colony does not change/, "L'origine d'une colonie ne change pas."],
  [/already stands in this apiary/, 'La ruche est déjà dans ce rucher.'],
  [/Not before/, 'Cette date précède le début de la période en cours.'],
  [/in the future/, 'Cette date est dans le futur.'],
  [/already stored/, 'La ruche est déjà remisée.'],
  [/already retired/, 'La ruche est déjà réformée.'],
  [/cannot place a hive/, "Vous ne pouvez pas placer de ruche dans ce rucher."],
  [/type of a hive cannot be changed/, "Le type d'une ruche ne change pas."],
  [/already entrusted/, 'La ruche est déjà confiée à cette personne.'],
  [/not a member of the association/, "Cette personne n'est pas membre de l'association."],
  [/is used by (\d+) hive/, 'Ce type est utilisé par des ruches : il ne peut pas être supprimé.'],
  [/maximum number of bars/, 'Indiquez le nombre maximal de barrettes.'],
  [/bars per box/, 'Indiquez le nombre de barrettes par élément.'],
  [/two colonies/, 'Seule une ruche à barrettes horizontales accueille deux colonies.'],
  [/Hives still stand in this apiary/, 'Des ruches sont encore dans ce rucher : déplacez-les ou remisez-les d\'abord.'],
];

function flatten(data: unknown): string[] {
  if (typeof data === 'string') return [data];
  if (Array.isArray(data)) return data.flatMap(flatten);
  if (data && typeof data === 'object') return Object.values(data).flatMap(flatten);
  return [];
}

/** The server's explanation of a failed call, in French. */
export function hiveErrorOf(error: unknown): string {
  const response = (error as AxiosErrorResponse).response;
  if (!response) return 'Le serveur ne répond pas. Réessayez plus tard.';
  if (response.status === 403) return "Vous n'avez pas le droit de faire cela.";
  if (response.status === 404) return "Cette ruche est introuvable, ou vous n'y avez pas accès.";
  for (const text of flatten(response.data)) {
    for (const [pattern, message] of MESSAGES) {
      const match = text.match(pattern);
      if (match) return typeof message === 'string' ? message : message(match);
    }
  }
  return 'Une erreur est survenue.';
}

export interface PlaceableApiary {
  id: number;
  label: string;
}

/**
 * The apiaries the user may put a hive in: their own and those an
 * association lets them update (platform admins: every apiary).
 */
export async function fetchPlaceableApiaries(isAdmin: boolean): Promise<PlaceableApiary[]> {
  const scopes = isAdmin ? ['all'] : ['mine', 'shared'];
  const pages = await Promise.all(scopes.map((scope) => api.get('/apiaries/managed/', {
    params: { scope, ordering: 'address', page_size: 200 },
  })));
  const seen = new Set<number>();
  const result: PlaceableApiary[] = [];
  for (const page of pages) {
    for (const apiary of page.data.results as {
      id: number; address?: string; host_name?: string; permissions?: { update: boolean };
    }[]) {
      if (seen.has(apiary.id) || !apiary.permissions?.update) continue;
      seen.add(apiary.id);
      const place = apiary.address || `Rucher #${apiary.id}`;
      result.push({ id: apiary.id, label: apiary.host_name ? `${place} (${apiary.host_name})` : place });
    }
  }
  return result;
}

/** How an apiary reads in a hive sheet or list. */
export function apiaryLabel(apiary: ApiarySummary): string {
  return apiary.address || `Rucher #${apiary.id}`;
}

/** The associations a new hive may belong to (besides the user). */
export async function fetchOwnerGroups(): Promise<{ path: string; name: string }[]> {
  return (await api.get('/hives/owner-groups/')).data;
}
