import { MODULES, findModule } from '../config/modules';

export interface Crumb {
  label: string;
  path: string;
}

/**
 * Breadcrumb trail for the current route, derived from the module config:
 * `/nests` → [Nids], `/docs/nests` → [Documentation, Nids]. The site name
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
  return crumbs;
}
