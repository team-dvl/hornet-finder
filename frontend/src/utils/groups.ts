/** Keycloak group paths as the UI uses them. */

/** Group paths the user belongs to, as seen from the token (`/x/admin` counts as `/x`). */
export function memberGroups(paths: string[]): string[] {
  const groups = new Set(paths.map((path) => path.replace(/\/admin(\/.*)?$/, '')).filter(Boolean));
  return Array.from(groups).sort();
}

export const BEEKEEPERS_ROOT = '/beekeepers';
export const TRAPPERS_ROOT = '/trappers';

/**
 * A beekeeper association, `/beekeepers/<id>`: the only groups a trap can be
 * delegated to (same rule as `is_beekeeper_group` in the backend).
 */
export function isBeekeeperGroup(path: string): boolean {
  const segments = path.replace(/^\/+|\/+$/g, '').split('/');
  return segments.length === 2 && `/${segments[0]}` === BEEKEEPERS_ROOT
    && Boolean(segments[1]) && segments[1] !== 'admin';
}
