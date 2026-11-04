/**
 * New versions of the app reach a phone without waiting for the system to
 * close it.
 *
 * The browser looks for a new service worker only when a page loads, and an
 * installed app on a phone mostly comes back from the background (no load),
 * so the check is also asked here when the app comes back to the front, when
 * the network comes back, and every hour while it stays in front.
 *
 * The new worker takes over at once (`skipWaiting` in `sw.ts`), but the page
 * still runs the former code: it is reloaded when nothing can be lost, that
 * is no dialog or sheet open and no field typed in on the page. Otherwise
 * the reload waits for the next change of page, or for the dialog to close.
 */
import { registerSW } from 'virtual:pwa-register';
import { openOverlayCount, subscribeOverlays } from './overlayHistory';

/** Shortest delay between two checks, so that quick back-and-forths cost nothing. */
const MIN_CHECK_INTERVAL_MS = 60 * 1000;
/** Check while the app stays in front. */
const PERIODIC_CHECK_MS = 60 * 60 * 1000;

let registration: ServiceWorkerRegistration | undefined;
let lastCheck = 0;
/** A new version controls the page, which still runs the former code */
let reloadPending = false;
/** A field of the page was typed in since the last change of page */
let edited = false;

function checkForUpdate(force = false): void {
  if (!registration || !navigator.onLine) return;
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (!force && now - lastCheck < MIN_CHECK_INTERVAL_MS) return;
  lastCheck = now;
  // Unreachable server or worker being replaced: the next occasion retries
  registration.update().catch(() => undefined);
}

/** Back from Keycloak: a reload would replay a code already exchanged. */
function inSigninCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') && params.has('state');
}

function reloadIfSafe(): void {
  if (!reloadPending || edited || openOverlayCount() > 0 || inSigninCallback()) return;
  reloadPending = false;
  window.location.reload();
}

/**
 * Called on every change of page (pathname): the former page's input is gone
 * anyway, so this is the moment to load the new version. The reload keeps the
 * new address and its router state (`history.state` survives a reload).
 */
export function noteNavigation(): void {
  edited = false;
  reloadIfSafe();
}

/** Registers the service worker and starts watching for new versions. */
export function initAppUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  // Any typing in the page (a field outside a dialog) holds the reload back
  document.addEventListener('input', () => { edited = true; }, true);
  subscribeOverlays(reloadIfSafe);

  registerSW({
    immediate: true,
    onNeedReload() {
      reloadPending = true;
      reloadIfSafe();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (!reg) return;
      const onResume = () => checkForUpdate();
      document.addEventListener('visibilitychange', onResume);
      // Page restored from the back-forward cache
      window.addEventListener('pageshow', onResume);
      window.addEventListener('online', onResume);
      window.setInterval(() => checkForUpdate(true), PERIODIC_CHECK_MS);
    },
  });
}
