import { MODULES } from '../config/modules';

export interface Crumb {
  label: string;
  path: string;
}

/** Sections of the administration module, for the breadcrumb trail. */
const ADMIN_SECTIONS: Record<string, string> = {
  'trap-types': 'Types de pièges',
  species: 'Espèces',
  archiving: 'Archivage',
  tags: 'QR Codes',
  group: 'Groupe',
  platform: 'Plateforme',
  notifications: 'Envois',
  audit: "Journal d'audit",
};

/** Pages reached from the platform dashboard: its crumb comes first. */
const UNDER_PLATFORM = new Set(['audit']);

/** Statistics with a page, for the breadcrumb trail (short names). */
export const STAT_SECTIONS: Record<string, string> = {
  'traps-catches': 'Captures FA',
  'traps-species': 'Espèces',
  'trap-types': 'Types de piège',
  'traps-ranking': 'Classement',
  'traps-coverage': 'Couverture',
  'traps-pressure': 'Pression',
};

/**
 * Breadcrumb trail for the current route, derived from the module config:
 * `/nests` → [Nids],
 * `/admin/trap-types` → [Administration, Types de pièges], `/admin/audit` →
 * [Administration, Plateforme, Journal d'audit], `/admin/notifications` →
 * [Administration, Plateforme, Notifications, Envois]. The site name
 * (link to `/`) is prepended by the navbar itself.
 */
export function getBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const module = MODULES.find((m) => m.path === `/${segments[0]}`);
  if (!module?.path) return [];

  const crumbs: Crumb[] = [{ label: module.shortTitle, path: module.path }];
  if (module.id === 'stats' && segments[1]) {
    const section = STAT_SECTIONS[segments[1]];
    if (section) {
      crumbs.push({ label: section, path: `/stats/${segments[1]}` });
    }
  }
  if (module.id === 'admin' && segments[1]) {
    const path = segments.slice(0, 2).join('/');
    if (segments[1] === 'platform' && segments[2] === 'notifications') {
      crumbs.push({ label: ADMIN_SECTIONS.platform, path: '/admin/platform' },
        { label: 'Notifications', path: '/admin/platform/notifications' });
    } else if (segments[1] === 'notifications') {
      // The deliveries: reached from the notification switches
      crumbs.push({ label: ADMIN_SECTIONS.platform, path: '/admin/platform' },
        { label: 'Notifications', path: '/admin/platform/notifications' },
        { label: ADMIN_SECTIONS.notifications, path: `/${path}` });
    } else if (ADMIN_SECTIONS[segments[1]]) {
      if (UNDER_PLATFORM.has(segments[1])) crumbs.push({ label: ADMIN_SECTIONS.platform, path: '/admin/platform' });
      crumbs.push({ label: ADMIN_SECTIONS[segments[1]], path: `/${path}` });
    }
  }
  return crumbs;
}
