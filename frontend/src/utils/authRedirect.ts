import type { AuthContextProps } from 'react-oidc-context';

/**
 * Redirect URI pointing at the page the user is currently on (origin + path,
 * no query string). The Keycloak clients allow `https://<host>/*`, so any
 * client-side route is a valid landing point after login.
 */
export function currentPageRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Start the Keycloak login flow and come back to the current page afterwards
 * instead of the configured default (`window.location.origin`, i.e. the landing page).
 */
export function signInFromCurrentPage(auth: AuthContextProps): Promise<void> {
  return auth.signinRedirect({ redirect_uri: currentPageRedirectUri() });
}

/** Keycloak account console URL, with a "back to application" link pointing at the landing page. */
export function accountConsoleUrl(authority: string, clientId: string): string {
  const referrerUri = encodeURIComponent(`${window.location.origin}/`);
  return `${authority}/account?referrer=${clientId}&referrer_uri=${referrerUri}`;
}
