import api from './api';
import type { NotificationKind } from './pushApi';

/** Platform dashboard, see `hornet/platform_views.py`. */

export interface PlatformKind {
  id: NotificationKind;
  label: string;
  /** Held back for everyone by the platform admins */
  paused: boolean;
}

export interface PlatformNotifications {
  /** The server has its VAPID keys: Web Push is available at all */
  configured: boolean;
  kinds: PlatformKind[];
  updated_at: string | null;
  updated_by: string | null;
}

export interface DeliveryWindow {
  notifications: number;
  deliveries: number;
  /** Accepted by the push service (HTTP 201) */
  accepted: number;
  /** Device gone (404/410) */
  gone: number;
  /** Held back by the platform after the delivery was queued */
  paused: number;
  failed: number;
  waiting: number;
  /** Devices that confirmed the display */
  shown: number;
  /** Median seconds between the sending and the device's confirmation */
  median_seconds: number | null;
}

export interface PlatformDashboardData {
  notifications: PlatformNotifications;
  devices: {
    total: number;
    people: number;
    users: number;
    by_device: { device: string; count: number }[];
  };
  deliveries: { day: DeliveryWindow; week: DeliveryWindow };
  scheduler: { last_pass_at: string | null; ok: boolean; stale_after_minutes: number };
  waiting: { nest_events: number };
}

export async function fetchDashboard(): Promise<PlatformDashboardData> {
  return (await api.get('/platform/')).data;
}

/** Sets the complete list of kinds held back for everyone. */
export async function setPausedKinds(paused: NotificationKind[]): Promise<PlatformNotifications> {
  return (await api.put('/platform/notifications/', { paused })).data;
}
