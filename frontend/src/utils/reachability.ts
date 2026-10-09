import { renewIfNeeded } from './oidc';

/**
 * Is the server reachable from here? `navigator.onLine` cannot tell: on a
 * mobile network the device is online while an edge firewall drops every
 * packet to the server (or there is no coverage). The answer comes from a
 * probe of `/api/ping`, a static answer of nginx.
 *
 * The probe is event driven so that an idle app stays silent (one token
 * renewal an hour): launch, return to the foreground, network events, and any
 * API call that fails without an answer. Only while the server is unreachable
 * does it retry on its own, with a growing delay, and only if the app is shown.
 */

const PING_URL = '/api/ping';

/** A dropped connection never answers: give up after this delay. */
const PROBE_TIMEOUT_MS = 5000;

/** Least delay between two probes started by events (they often come in bursts). */
const MIN_GAP_MS = 10_000;

/** Delays between retries while unreachable; the last one repeats. */
const RETRY_DELAYS_MS = [5000, 10_000, 20_000, 30_000, 60_000];

/** Share of the retry delay added or removed at random, to spread the clients. */
const JITTER = 0.2;

export interface ReachabilityState {
  /** The last probe failed, or the device reports being offline. */
  unreachable: boolean;
  /** A probe is running. */
  checking: boolean;
}

let state: ReachabilityState = { unreachable: false, checking: false };
const listeners = new Set<() => void>();

let pending: Promise<boolean> | null = null;
let lastProbeAt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

function setState(patch: Partial<ReachabilityState>): void {
  const next = { ...state, ...patch };
  if (next.unreachable === state.unreachable && next.checking === state.checking) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeReachability(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getReachability(): ReachabilityState {
  return state;
}

/** One request to the ping endpoint: `true` only for the answer of our own nginx. */
async function ping(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(PING_URL, { cache: 'no-store', signal: controller.signal });
    // A block page or a captive portal also answers: check what the answer is
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return false;
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && (body as { status?: unknown }).status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function clearRetry(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry(): void {
  clearRetry();
  if (document.visibilityState !== 'visible') return; // resumed by the next visibilitychange
  const base = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
  retryCount += 1;
  const delay = base * (1 + JITTER * (2 * Math.random() - 1));
  retryTimer = setTimeout(() => { void probe(true); }, delay);
}

/**
 * Probe the server. Concurrent callers share one request. Unless `force`d
 * (a tap on the retry button, a scheduled retry), a probe made less than
 * `MIN_GAP_MS` ago stands for the answer.
 */
export function probe(force = false): Promise<boolean> {
  if (pending) return pending;
  if (!force && Date.now() - lastProbeAt < MIN_GAP_MS) return Promise.resolve(!state.unreachable);

  clearRetry();
  lastProbeAt = Date.now();
  setState({ checking: true });
  pending = ping().then((reachable) => {
    const recovered = state.unreachable && reachable;
    setState({ unreachable: !reachable, checking: false });
    if (reachable) {
      retryCount = 0;
      // The renewal may have been skipped while the server was out of reach
      if (recovered) void renewIfNeeded();
    } else {
      scheduleRetry();
    }
    return reachable;
  }).finally(() => { pending = null; });
  return pending;
}

/**
 * An API call failed without any answer (no network, dropped, timeout): the
 * server may be unreachable. Confirmed by a probe, not taken for granted, as
 * a single call can fail for its own reasons.
 */
export function reportNetworkFailure(): void {
  void probe();
}

let monitoring = false;

/** Start watching the events that call for a probe. Idempotent. */
export function startReachabilityMonitor(): void {
  if (monitoring) return;
  monitoring = true;

  const check = () => {
    if (document.visibilityState === 'visible') void probe();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probe(state.unreachable);
    else clearRetry();
  });
  // Page restored from the back-forward cache
  window.addEventListener('pageshow', check);
  window.addEventListener('online', () => { void probe(true); });
  // Reliable in this direction: the device itself says it has no network
  window.addEventListener('offline', () => {
    setState({ unreachable: true });
    scheduleRetry();
  });

  if (navigator.onLine === false) setState({ unreachable: true });
  check();
}
