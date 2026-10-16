import api from './api';
import type { ModuleId } from '../config/modules';

/**
 * What waits for the user in each module (`GET /api/pending/`): the red badge
 * on the module's landing tile and menu entry, by the same rule as the
 * module's first tab (backend `hornet/pending.py`).
 *
 * One small shared store, so the landing page and the navbar of every page
 * do not each ask: the counts are kept `FRESH_MS`, and `refreshPending()`
 * asks again after an action that changes them (a reading, a verification…).
 */

export type PendingCounts = Partial<Record<ModuleId, number>>;

const FRESH_MS = 60_000;
const EMPTY: PendingCounts = {};

let counts: PendingCounts = EMPTY;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: PendingCounts) {
  counts = next;
  listeners.forEach((listener) => listener());
}

export function subscribePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPending(): PendingCounts {
  return counts;
}

/** Ask the server, unless the counts are fresh (or `force`). Failures keep what is shown: a badge is a hint. */
export function loadPending(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
  inflight = api.get('/pending/')
    .then((response) => {
      fetchedAt = Date.now();
      publish(response.data as PendingCounts);
    })
    .catch(() => { /* nothing shown without the counts */ })
    .finally(() => { inflight = null; });
  return inflight;
}

/** After an action that may change what waits. */
export function refreshPending(): void {
  void loadPending(true);
}

/** Signed out: nothing waits for anyone. */
export function clearPending(): void {
  fetchedAt = 0;
  if (counts !== EMPTY) publish(EMPTY);
}
