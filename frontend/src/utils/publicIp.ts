/**
 * Public IP address(es) of the device, as the servers on the Internet see
 * them: what to give whoever manages the edge firewall's allowlist when the
 * server cannot be reached. Asked of a third party (ipify), as our own server
 * is the one that does not answer, and only when the user opens the help of
 * the "Serveur injoignable" banner.
 *
 * Both families are asked, as a phone often has an IPv6 address next to (or
 * instead of) an IPv4 one, and the firewall sees the one the connection uses.
 */

export interface PublicIps {
  v4?: string;
  v6?: string;
}

const SERVICES = {
  v4: 'https://api.ipify.org?format=json',
  v6: 'https://api6.ipify.org?format=json',
} as const;

const TIMEOUT_MS = 4000;

/** What is shown is checked: nothing else than an address ends up in the page. */
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

/** Answers are kept for a minute, so that opening the help again does not ask again. */
const CACHE_MS = 60_000;
let cached: { at: number; ips: PublicIps } | null = null;
let pending: Promise<PublicIps> | null = null;

async function ask(url: string, valid: RegExp): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const ip = typeof body === 'object' && body !== null ? (body as { ip?: unknown }).ip : undefined;
    return typeof ip === 'string' && valid.test(ip) ? ip : undefined;
  } catch {
    return undefined; // no such family on this connection, or the service is out of reach
  } finally {
    clearTimeout(timeout);
  }
}

/** Concurrent callers (a remount in development) share one round of requests. */
export function fetchPublicIps(): Promise<PublicIps> {
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.ips);
  pending ??= Promise.all([ask(SERVICES.v4, IPV4), ask(SERVICES.v6, IPV6)])
    .then(([v4, v6]) => {
      const ips: PublicIps = { v4, v6 };
      if (v4 || v6) cached = { at: Date.now(), ips };
      return ips;
    })
    .finally(() => { pending = null; });
  return pending;
}
