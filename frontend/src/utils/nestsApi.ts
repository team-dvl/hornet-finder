import api from './api';
import type { Nest, NestStatus } from '../store/store';

/**
 * The lists of the nests module: the nests of the season to search and
 * filter (`GET /api/nests/managed/`) and what waits for the requester
 * (`GET /api/nests/todo/`).
 */

export type NestScope = 'all' | 'mine';
export type NestOrdering = '-created_at' | 'created_at' | '-last_event_at' | 'last_event_at';

export interface ManagedNestsQuery {
  show: NestScope;
  /** Statuses, `open` standing for reported and confirmed */
  status: (NestStatus | 'open')[];
  q?: string;
  ordering: NestOrdering;
}

export interface NestPage {
  count: number;
  next: string | null;
  results: Nest[];
}

export async function fetchManagedNests(query: ManagedNestsQuery, page = 1): Promise<NestPage> {
  const params: Record<string, string | number> = { show: query.show, ordering: query.ordering, page };
  if (query.status.length) params.status = query.status.join(',');
  if (query.q) params.q = query.q;
  return (await api.get('/nests/managed/', { params })).data;
}

/** Sections of "À traiter"; those that do not concern the requester are absent */
export interface NestTodo {
  /** Coordinators: reported, waiting for a visit (oldest first) */
  to_verify?: Nest[];
  /** Coordinators: confirmed, waiting for their destruction */
  confirmed?: Nest[];
  /** Owners of apiaries: active nests within 1 km of one of theirs */
  near_apiaries?: Nest[];
  /** Everyone: their own reports of the season */
  mine: Nest[];
}

export async function fetchNestTodo(): Promise<NestTodo> {
  return (await api.get('/nests/todo/')).data;
}
