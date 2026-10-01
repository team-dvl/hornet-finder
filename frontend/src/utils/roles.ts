/**
 * Application roles, as Keycloak puts them in `realm_access.roles`.
 * Same names and legacy mapping as the backend (`hornet_finder_api/roles.py`).
 */

export const ADMIN = 'admin';
/** Apiaries, their traps, and hornet sightings at the hives */
export const BEEKEEPER = 'beekeeper';
/** Nest hunters: hornet sightings and releases, every nest */
export const HUNTER = 'hunter';
/** Trap campaign: traps and their QR Codes; the default role of a new account */
export const TRAPPER = 'trapper';

export type AppRole = typeof ADMIN | typeof BEEKEEPER | typeof HUNTER | typeof TRAPPER;

export const APP_ROLES: AppRole[] = [ADMIN, BEEKEEPER, HUNTER, TRAPPER];

export const ROLE_LABELS: Record<AppRole, string> = {
  [ADMIN]: 'Administrateur',
  [BEEKEEPER]: 'Apiculteur',
  [HUNTER]: 'Chasseur de nids',
  [TRAPPER]: 'Piégeur',
};

// Renamed in Keycloak but still carried by tokens issued before the change:
// `volunteer` held both trades before they were split.
// TODO: remove in the release after the Keycloak migration (prod note 0018).
const LEGACY_ROLES: Record<string, AppRole[]> = { volunteer: [HUNTER, TRAPPER] };

/** The application roles of a token, legacy names replaced by the current ones. */
export function appRoles(realmRoles: string[] | undefined): AppRole[] {
  const roles = new Set<AppRole>();
  (realmRoles || []).forEach((role) => {
    const names = LEGACY_ROLES[role] || [role];
    names.forEach((name) => {
      if ((APP_ROLES as string[]).includes(name)) roles.add(name as AppRole);
    });
  });
  return APP_ROLES.filter((role) => roles.has(role));
}
