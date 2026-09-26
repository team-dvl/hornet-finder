import { MODULES, findModule } from '../config/modules';

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
};

/**
 * Breadcrumb trail for the current route, derived from the module config:
 * `/nests` → [Nids], `/docs/nests` → [Documentation, Nids],
 * `/admin/trap-types` → [Administration, Types de pièges]. The site name
 * (link to `/`) is prepended by the navbar itself.
 */
export function getBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const module = MODULES.find((m) => m.path === `/${segments[0]}`);
  if (!module?.path) return [];

  const crumbs: Crumb[] = [{ label: module.shortTitle, path: module.path }];
  if (module.id === 'docs' && segments[1]) {
    const documented = findModule(segments[1]);
    if (documented) {
      crumbs.push({ label: documented.shortTitle, path: `/docs/${documented.id}` });
    }
  }
  if (module.id === 'admin' && segments[1]) {
    const section = ADMIN_SECTIONS[segments[1]];
    if (section) {
      crumbs.push({ label: section, path: `/admin/${segments[1]}` });
    }
  }
  return crumbs;
}
