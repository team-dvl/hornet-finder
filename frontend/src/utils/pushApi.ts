import api from './api';
import type { AxiosErrorResponse } from './axiosTypes';

/** Web Push, see `hornet/push_views.py`. */

export interface PushConfig {
  enabled: boolean;
  public_key: string | null;
}

export interface PushDevice {
  id: number;
  device: string;
  installed: boolean;
  created_at: string;
  /** Last time the app was opened on this device; unused for 6 months, it is forgotten */
  last_seen_at: string;
  endpoint: string;
}

export interface SentSummary {
  id: string;
  /** People addressed */
  recipients: number;
  /** Of those, how many have a device */
  reached: number;
  /** Of those, how many turned this kind of message off */
  muted: number;
  devices: number;
}

/** A kind of notification the user can turn off, for all their devices */
export type NotificationKind = 'trap_reading' | 'trap_refill' | 'trap_handover' | 'nest_new' | 'nest_near_apiary' | 'nest_followup'
  | 'group_message' | 'platform_message';

export interface NotificationPreference {
  id: NotificationKind;
  label: string;
  enabled: boolean;
}

export interface PushDeliveryRow {
  id: string;
  notification: string;
  title: string;
  kind: NotificationKind | 'test';
  created_at: string;
  device: string;
  installed: boolean;
  /** HTTP status of the push service (201 accepted), 0 unreachable, null not sent yet */
  status: number | null;
  error: string;
  seconds_to_receive: number | null;
}

export interface NotificationDraft {
  group_path: string;
  title: string;
  body: string;
  /** One member of the group; the whole group when absent */
  guid?: string;
}

export async function fetchPushConfig(): Promise<PushConfig> {
  return (await api.get('/push/config/')).data;
}

export async function fetchMyDevices(): Promise<PushDevice[]> {
  return (await api.get('/push/subscriptions/')).data;
}

/** Registers (or hands to the signed-in user) the browser's subscription. */
export async function registerDevice(subscription: PushSubscriptionJSON, installed: boolean): Promise<PushDevice> {
  return (await api.post('/push/subscriptions/', { ...subscription, installed })).data;
}

export async function forgetDevice(endpoint: string): Promise<void> {
  await api.delete('/push/subscriptions/', { params: { endpoint } });
}

export async function sendTest(): Promise<{ devices: number }> {
  return (await api.post('/push/test/')).data;
}

export async function sendNotification(draft: NotificationDraft): Promise<SentSummary> {
  return (await api.post('/push/send/', draft)).data;
}

export async function fetchPreferences(): Promise<NotificationPreference[]> {
  return (await api.get('/push/preferences/')).data.kinds;
}

export async function savePreference(kind: NotificationKind, enabled: boolean): Promise<NotificationPreference[]> {
  return (await api.put('/push/preferences/', { [kind]: enabled })).data.kinds;
}

export async function fetchDeliveries(): Promise<PushDeliveryRow[]> {
  return (await api.get('/push/deliveries/')).data;
}

/** The server's explanation of a failed call, in French. */
export function pushErrorOf(error: unknown): string {
  const data = (error as AxiosErrorResponse).response?.data;
  if (!data) return 'Le serveur ne répond pas. Réessayez plus tard.';
  if (typeof data.detail === 'string') return data.detail;
  // Field errors: {title: ["…"]}
  const first = Object.values(data).flat().find((value) => typeof value === 'string');
  return (first as string | undefined) ?? 'Une erreur est survenue.';
}
