import api from './api';
import type { Trap } from '../store/store';

/**
 * What the user's own traps wait for: a reading or a renewal of the
 * attractant, by the delays of their type. See `GET /api/traps/due/`.
 */

export type DueKind = 'trap_reading' | 'trap_refill';

export interface DueItem {
  kind: DueKind;
  trap: Trap;
  interval_days: number;
  /** Last reading or refill, else the installation (ISO date) */
  last_on: string;
  /** `last_on` is the installation: nothing recorded since */
  from_installation: boolean;
  due_on: string;
  /** Days past the due date; negative when not due yet */
  days_late: number;
}

/** Due by today, plus what falls due within `days` days. */
export async function fetchDue(days = 1): Promise<DueItem[]> {
  return (await api.get('/traps/due/', { params: { days } })).data;
}
