import api from './api';
import type { AxiosErrorResponse } from './axiosTypes';

/**
 * The audit trail (platform admins only, read-only): see `backend/audit/` and
 * `doc/AUDIT_TRAIL.md`. Labels and the formatting of the details are in
 * `auditLabels.ts`.
 */

export type AuditSource = 'api' | 'system' | 'backfill';

export interface AuditPerson {
  name: string | null;
  /** The account no longer exists in Keycloak */
  deleted: boolean;
}

export interface AuditEvent {
  id: number;
  occurred_at: string;
  /** `<domain>.<verb>`, e.g. `nest.destroyed` */
  action: string;
  domain: string;
  actor: string | null;
  actor_name: string | null;
  actor_deleted: boolean;
  actor_roles: string[];
  source: AuditSource;
  target_type: string;
  target_id: string;
  /** How the target read at the time: an address, a name, a QR code */
  target_label: string;
  /** Every object concerned, as `type:id` */
  refs: string[];
  /** Update: `{field: [before, after]}`; deletion: the object as it was; otherwise what describes the action */
  changes: Record<string, unknown>;
  request_id: string | null;
  /** Names of the people the event names (actor, owners, members…) */
  people: Record<string, AuditPerson>;
}

export interface AuditPage {
  results: AuditEvent[];
  /** Absolute URL of the next page, or null at the end */
  next: string | null;
}

/** Filters of the list, as the API names them */
export interface AuditFilters {
  since?: string;
  until?: string;
  actor?: string;
  action?: string;
  domain?: string;
  ref?: string;
  source?: AuditSource | '';
  request?: string;
  q?: string;
}

export interface AuditActor {
  guid: string;
  name: string;
}

export interface AuditExportLink {
  url: string;
  filename: string;
  expires_in: number;
}

export class AuditError extends Error {}

function fail(error: unknown): never {
  const response = (error as AxiosErrorResponse).response;
  if (!response) throw new AuditError('Impossible de joindre le serveur.');
  if (response.status === 403) throw new AuditError('Réservé aux administrateurs de la plateforme.');
  const data = response.data as Record<string, unknown> | undefined;
  const detail = data && Object.values(data).flat().find((value) => typeof value === 'string');
  throw new AuditError(typeof detail === 'string' ? detail : 'Une erreur est survenue.');
}

/** Keeps the filters that are set */
function clean(filters: AuditFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as Record<string, string>;
}

/** First page of the events matching the filters, newest first. */
export async function fetchAuditEvents(filters: AuditFilters): Promise<AuditPage> {
  try {
    return (await api.get('/audit/events/', { params: clean(filters) })).data;
  } catch (error) {
    fail(error);
  }
}

/** The page after `next` (a cursor URL given by the previous page). */
export async function fetchAuditPage(next: string): Promise<AuditPage> {
  try {
    const url = new URL(next, window.location.origin);
    // The client adds `/api` itself
    return (await api.get(`${url.pathname.replace(/^\/api/, '')}${url.search}`)).data;
  } catch (error) {
    fail(error);
  }
}

/** Accounts whose name or email contains `query` (2 characters at least). */
export async function searchAuditActors(query: string): Promise<AuditActor[]> {
  try {
    return (await api.get('/audit/events/actors/', { params: { q: query } })).data;
  } catch (error) {
    fail(error);
  }
}

/** A link (15 minutes) to the CSV of the events matching the filters, opened without a session. */
export async function fetchAuditExportLink(filters: AuditFilters): Promise<AuditExportLink> {
  try {
    return (await api.post('/audit/events/export-link/', { filters: clean(filters) })).data;
  } catch (error) {
    fail(error);
  }
}
