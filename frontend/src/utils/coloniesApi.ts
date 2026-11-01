import api from './api';
import {
  newHiveId, type ApiarySummary, type BarFamily, type ColonyOrigin, type ColonySummary, type Hive, type HiveStatus,
} from './hivesApi';

/**
 * Colonies of the hives, see `backend/apiculture/colony_views.py`. A colony
 * lives in a hive compartment and keeps its identity when it moves; its
 * births (division, swarm) and its end are dated actions.
 */

export type ColonyEnd = 'died' | 'merged' | 'absconded' | 'swarmed' | 'unknown';

export interface ColonyHive {
  id: string;
  name: string;
  number: string;
  status: HiveStatus;
  hive_type_name: string;
  bar_family: BarFamily;
  apiary: ApiarySummary | null;
}

export interface Colony extends ColonySummary {
  end_cause: ColonyEnd | '';
  comments: string;
  created_at: string;
  updated_at: string;
  hive: ColonyHive;
  parent: ColonySummary | null;
  merged_into: ColonySummary | null;
  permissions?: { edit: boolean; manage: boolean };
  /** Detail only */
  children?: ColonySummary[];
  occupancies?: {
    hive: { id: string; name: string; number: string };
    compartment: 1 | 2;
    started_on: string;
    ended_on: string | null;
  }[];
}

export const ORIGIN_LABELS: Record<ColonyOrigin, string> = {
  division: 'Division',
  swarm_parent: 'Souche après essaimage',
  swarm_caught: 'Essaim récolté',
  package: 'Essaim nu acheté',
  unknown: 'Origine inconnue',
};

export const END_LABELS: Record<ColonyEnd, string> = {
  died: 'Morte',
  merged: 'Réunie',
  absconded: 'Désertée',
  swarmed: 'Essaimée',
  unknown: 'Fin inconnue',
};

/** A colony as it is named: its name, else its origin and start. */
export function colonyLabel(colony: Pick<ColonySummary, 'name' | 'origin' | 'started_on'>): string {
  if (colony.name) return colony.name;
  const [year, month, day] = colony.started_on.split('-');
  return `${ORIGIN_LABELS[colony.origin]} du ${day}/${month}/${year}`;
}

/** What the count of a colony counts in a hive of this family. */
export function countLabel(family: BarFamily): string | null {
  if (family === 'topbar') return 'Barrettes';
  if (family === 'warre') return 'Éléments';
  return null;
}

/** A count typed in a field, or null when left empty. */
export function countOf(value: string): number | null {
  return value.trim() === '' ? null : Math.max(0, Math.round(Number(value)));
}

const DAY_MS = 24 * 3600 * 1000;

/** Whole days from `from` to `to` (ISO dates). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

export interface ColonyValues {
  name: string;
  bars: number | null;
  comments: string;
}

export interface NewColonyValues extends ColonyValues {
  hive: string;
  compartment: 1 | 2;
  origin: Extract<ColonyOrigin, 'swarm_caught' | 'package' | 'unknown'>;
  started_on: string;
}

export async function fetchColonies(params: { hive?: string; status?: 'active' | 'ended' | 'all' } = {}): Promise<Colony[]> {
  return (await api.get('/colonies/', { params })).data;
}

export async function fetchColony(id: string): Promise<Colony> {
  return (await api.get(`/colonies/${id}/`)).data;
}

export async function createColony(values: NewColonyValues): Promise<Colony> {
  return (await api.post('/colonies/', { id: newHiveId(), ...values })).data;
}

export async function updateColony(id: string, values: Partial<ColonyValues>): Promise<Colony> {
  return (await api.patch(`/colonies/${id}/`, values)).data;
}

export async function deleteColony(id: string): Promise<void> {
  await api.delete(`/colonies/${id}/`);
}

export interface SplitValues {
  on: string;
  /** Another hive; absent: the other compartment of the same hive */
  hive?: string;
  compartment?: 1 | 2;
  name: string;
  /** Bars taken from the parent */
  bars: number | null;
  /** Divider put for the occasion, in the same hive */
  divider_bar?: number;
  queen: 'parent' | 'daughter' | 'unknown';
}

/** Answers with the parent colony. */
export async function splitColony(id: string, values: SplitValues): Promise<Colony> {
  return (await api.post(`/colonies/${id}/split/`, { daughter_id: newHiveId(), ...values })).data;
}

export interface CaughtSwarm {
  hive: string;
  compartment: 1 | 2;
  name: string;
  bars: number | null;
}

/** Answers with the colony that stayed. */
export async function swarmColony(id: string, on: string, caught: CaughtSwarm | null): Promise<Colony> {
  return (await api.post(`/colonies/${id}/swarm/`, {
    on, stayed_id: newHiveId(), caught: caught && { id: newHiveId(), ...caught },
  })).data;
}

export async function transferColony(id: string, values: { on: string; hive: string; compartment: 1 | 2; bars?: number | null }): Promise<Colony> {
  return (await api.post(`/colonies/${id}/transfer/`, values)).data;
}

export async function endColony(id: string, values: { on: string; cause: Exclude<ColonyEnd, 'swarmed'>; merged_into?: string }): Promise<Colony> {
  return (await api.post(`/colonies/${id}/end/`, values)).data;
}

export async function recordLaying(id: string, on: string): Promise<Colony> {
  return (await api.post(`/colonies/${id}/laying/`, { on })).data;
}

export async function setDivider(hiveId: string, dividerBar: number | null): Promise<Hive> {
  return (await api.post(`/hives/${hiveId}/divider/`, { divider_bar: dividerBar })).data;
}

/** The compartments of a hive in service that hold no colony (the second one only behind a divider). */
export function freeCompartments(hive: Hive): (1 | 2)[] {
  if (hive.status === 'retired') return [];
  const taken = new Set(hive.colonies.map((colony) => colony.compartment));
  const all: (1 | 2)[] = hive.max_colonies > 1 && hive.divider_bar ? [1, 2] : [1];
  return all.filter((compartment) => !taken.has(compartment));
}

/** Bars a compartment holds at most (null: no limit), as the server counts them. */
export function compartmentCapacity(hive: Hive, compartment: 1 | 2, divider = hive.divider_bar): number | null {
  if (hive.bar_family !== 'topbar' || !hive.max_bars) return null;
  if (!divider) return hive.max_bars;
  return compartment === 1 ? divider - 1 : hive.max_bars - divider;
}
