import { useEffect } from 'react';
import { clearPushBadge, currentSubscription, pushPermission, pushSupport } from '../utils/push';
import { forgetDevice, registerDevice } from '../utils/pushApi';
import { isInstalledPwa } from '../utils/pwa';

/**
 * A browser subscription belongs to whoever is signed in. On a shared phone,
 * the next person to sign in takes over the notifications of the device (the
 * server hands an endpoint to its latest registrant), so a message for the
 * previous user is not shown to this one. Runs once per sign-in, silently.
 */
export function usePushRebind(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || pushSupport() !== 'ok' || pushPermission() !== 'granted') return;
    let cancelled = false;
    currentSubscription()
      .then((subscription) => {
        if (cancelled || !subscription) return;
        return registerDevice(subscription.toJSON(), isInstalledPwa());
      })
      .catch(() => { /* notifications off on the server, or offline: nothing to rebind */ });
    return () => { cancelled = true; };
  }, [signedIn]);
}

/** Best effort at sign-out: the device stops receiving the signed-out user's notifications. */
export async function releasePushDevice(): Promise<void> {
  try {
    if (pushSupport() !== 'ok') return;
    const subscription = await currentSubscription();
    if (subscription) await forgetDevice(subscription.endpoint);
  } catch { /* never block the sign-out */ }
}

/** Clears the icon badge when the app opens and each time it comes back to the front. */
export function usePushBadgeReset() {
  useEffect(() => {
    const clear = () => { if (document.visibilityState === 'visible') void clearPushBadge(); };
    clear();
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('focus', clear);
    return () => {
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('focus', clear);
    };
  }, []);
}
