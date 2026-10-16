import { useCallback, useEffect, useState } from 'react';
import {
  currentSubscription, isStandalone, pushPermission, pushSupport, subscribeThisDevice, unsubscribeThisDevice,
  type PushSupport,
} from '../utils/push';
import {
  fetchPushConfig, forgetDevice, pushErrorOf, registerDevice, sendTest, type PushConfig,
} from '../utils/pushApi';

export interface PushState {
  /** `null` while the server has not answered */
  config: PushConfig | null;
  support: PushSupport;
  permission: NotificationPermission;
  /** This browser holds a subscription */
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  test: () => Promise<void>;
}

/** Notification settings of this device, for the profile dialog. */
export function usePush(): PushState {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(pushPermission());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const support = pushSupport();

  useEffect(() => {
    let cancelled = false;
    fetchPushConfig().then((result) => { if (!cancelled) setConfig(result); }).catch(() => {});
    if (support === 'ok') {
      currentSubscription().then((subscription) => { if (!cancelled) setSubscribed(subscription !== null); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [support]);

  const run = useCallback(async (action: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      if (message) setNotice(message);
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'permission-denied') setError("L'autorisation a été refusée : elle se rétablit dans les réglages du navigateur.");
      else if (code === 'no-worker') setError("Le service de l'application n'est pas prêt : rechargez la page.");
      else setError(pushErrorOf(failure));
    } finally {
      setPermission(pushPermission());
      setBusy(false);
    }
  }, []);

  const enable = useCallback(() => run(async () => {
    if (!config?.public_key) throw new Error('disabled');
    const subscription = await subscribeThisDevice(config.public_key);
    await registerDevice(subscription.toJSON(), isStandalone());
    setSubscribed(true);
  }), [config, run]);

  const disable = useCallback(() => run(async () => {
    const endpoint = await unsubscribeThisDevice();
    if (endpoint) await forgetDevice(endpoint);
    setSubscribed(false);
  }), [run]);

  const test = useCallback(() => run(async () => {
    const result = await sendTest();
    return `Essai envoyé à ${result.devices} appareil${result.devices > 1 ? 's' : ''}.`;
  }), [run]);

  return { config, support, permission, subscribed, busy, error, notice, enable, disable, test };
}
