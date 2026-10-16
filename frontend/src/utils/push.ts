import { isInstalledPwa, isIosDevice } from './pwa';
import { BADGE_CACHE } from './pushBadge';

/**
 * Web Push in this browser. The server side is `utils/pushApi.ts`; the worker
 * that shows the messages is `src/sw.ts`.
 *
 * What a browser needs: a service worker, the Push API, and the user's
 * permission, asked from a tap. On an iPhone or iPad (iOS 16.4 and later) the
 * Push API only exists in an app added to the home screen, not in a Safari tab.
 */

export type PushSupport = 'ok' | 'install-ios' | 'unsupported';

export function pushSupport(): PushSupport {
  if (isIosDevice() && !isInstalledPwa()) return 'install-ios';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'unsupported';
}

/** The permission, `denied` meaning only the browser's own settings can lift it. */
export function pushPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied';
}

/** The worker, or `null` when none registers (insecure page, private mode, no network at the first load). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const worker = await registration();
  return worker ? worker.pushManager.getSubscription() : null;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Asks the permission (from a tap) and subscribes with the server's VAPID key. */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription> {
  if (await Notification.requestPermission() !== 'granted') {
    throw new Error('permission-denied');
  }
  const worker = await registration();
  if (!worker) throw new Error('no-worker');
  const key = keyBytes(publicKey);
  const existing = await worker.pushManager.getSubscription();
  if (existing) {
    // A subscription made with another key (the server's keys changed) cannot be reused
    const sameKey = existing.options.applicationServerKey
      && new Uint8Array(existing.options.applicationServerKey).join() === key.join();
    if (sameKey) return existing;
    await existing.unsubscribe();
  }
  return worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Drops the browser's subscription; returns its endpoint so the server can forget it too. */
export async function unsubscribeThisDevice(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}

export function isStandalone(): boolean {
  return isInstalledPwa();
}

/**
 * The app is open: whatever it was notified about is now seen. Clears the icon
 * badge and its count, and closes the notifications still in the tray.
 */
export async function clearPushBadge(): Promise<void> {
  try { await navigator.clearAppBadge?.(); } catch { /* not supported, or no permission */ }
  try { await caches.delete(BADGE_CACHE); } catch { /* storage unavailable */ }
  if (pushSupport() !== 'ok') return;
  try {
    const worker = await registration();
    (await worker?.getNotifications())?.forEach((notification) => notification.close());
  } catch { /* nothing to close */ }
}
