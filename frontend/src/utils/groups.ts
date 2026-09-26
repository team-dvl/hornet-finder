/** Keycloak group paths as the UI uses them. */

/** Group paths the user belongs to, as seen from the token (`/x/admin` counts as `/x`). */
export function memberGroups(paths: string[]): string[] {
  const groups = new Set(paths.map((path) => path.replace(/\/admin(\/.*)?$/, '')).filter(Boolean));
  return Array.from(groups).sort();
}
