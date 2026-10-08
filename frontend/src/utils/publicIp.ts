/**
 * Public IP address(es) of the device, as the servers on the Internet see
 * them: what to give whoever manages the edge firewall's allowlist when the
 * server cannot be reached. Asked of a third party (ipify), as our own server
 * is the one that does not answer, and only when the user opens the help of
 * the "Serveur injoignable" banner.
 *
 * Both families are asked, as a phone often has an IPv6 address next to (or
 * instead of) an IPv4 one, and the firewall sees the one the connection uses.
 * Each is asked on its own, so that the one that answers is not kept waiting
 * for the other (a connection without IPv6 can wait for the timeout).
 */

export type IpFamily = 'v4' | 'v6';

const SERVICES: Record<IpFamily, string> = {
  v4: 'https://api.ipify.org?format=json',
  v6: 'https://api6.ipify.org?format=json',
};

const TIMEOUT_MS = 4000;

/** What is shown is checked: nothing else than an address ends up in the page. */
const VALID: Record<IpFamily, RegExp> = {
  v4: /^(\d{1,3}\.){3}\d{1,3}$/,
  v6: /^[0-9a-f:]{2,45}$/i,
};

/** Answers are kept for a minute, so that opening the help again does not ask again. */
const CACHE_MS = 60_000;
const cache: Partial<Record<IpFamily, { at: number; ip: string }>> = {};
const pending: Partial<Record<IpFamily, Promise<string | undefined>>> = {};

async function ask(family: IpFamily): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(SERVICES[family], {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const ip = typeof body === 'object' && body !== null ? (body as { ip?: unknown }).ip : undefined;
    return typeof ip === 'string' && VALID[family].test(ip) ? ip : undefined;
  } catch {
    return undefined; // no such family on this connection, or the service is out of reach
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Public IP address of one family, `undefined` if there is none or it cannot
 * be known. Concurrent callers (a remount in development) share one request.
 * Not even asked when the device says it has no network: that signal is
 * reliable in this direction, and the answer is known without waiting.
 */
export function fetchPublicIp(family: IpFamily): Promise<string | undefined> {
  const cached = cache[family];
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.ip);
  if (navigator.onLine === false) return Promise.resolve(undefined);
  pending[family] ??= ask(family)
    .then((ip) => {
      if (ip) cache[family] = { at: Date.now(), ip };
      return ip;
    })
    .finally(() => { delete pending[family]; });
  return pending[family];
}
