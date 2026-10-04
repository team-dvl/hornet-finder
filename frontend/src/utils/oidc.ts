import { ErrorResponse, User, UserManager, WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';

// The dev realm and client serve dev.velutina.ovh and the Vite dev server
const isDevelopment = window.location.hostname === 'dev.velutina.ovh' ||
                      window.location.hostname === 'localhost' ||
                      import.meta.env.DEV;

const realm = isDevelopment ? 'hornet-finder-dev' : 'hornet-finder';
const keycloakUrl = (import.meta.env.VITE_KEYCLOAK_URL || 'https://auth.velutina.ovh/').replace(/\/$/, '');

const settings: UserManagerSettings = {
  authority: `${keycloakUrl}/realms/${realm}`,
  client_id: isDevelopment ? 'hornet-app-dev' : 'hornet-app',
  redirect_uri: window.location.origin,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email membership',
  loadUserInfo: true,
  filterProtocolClaims: true,
  // The session (refresh token included) outlives a closed app or tab
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Renewal with the refresh token while the app runs; `useSessionGuard`
  // covers what this timer misses (launch, resume, network back)
  automaticSilentRenew: true,
  accessTokenExpiringNotificationTimeInSeconds: isDevelopment ? 300 : 600,
  silentRequestTimeoutInSeconds: isDevelopment ? 20 : 30,
  monitorSession: isDevelopment,
  checkSessionIntervalInSeconds: isDevelopment ? 30 : 60,
};

/** The one OIDC client of the app, shared by `AuthProvider` and the API client. */
export const userManager = new UserManager(settings);

/** Seconds of validity under which the session is renewed on launch or resume. */
const RENEW_BEFORE_SECONDS = settings.accessTokenExpiringNotificationTimeInSeconds ?? 60;

/** Seconds of validity a token must still have to be sent to the API. */
const MIN_VALIDITY_SECONDS = 30;

let pendingRefresh: Promise<User | null> | null = null;

/**
 * True when Keycloak refused the refresh token: the session ended there
 * (idle or maximum lifetime reached, logout, revocation). Any other failure
 * (offline, timeout, server error) leaves the session usable later.
 */
function isSessionEnded(error: unknown): boolean {
  return error instanceof ErrorResponse && error.error === 'invalid_grant';
}

/**
 * Forget the stored user once Keycloak has ended the session, so the app
 * shows the signed-out state instead of failing every call. Skipped when the
 * stored refresh token is no longer the one that failed: another renewal (the
 * library's timer, another tab) won the race and the session is fine.
 */
async function forgetEndedSession(failedRefreshToken: string | undefined): Promise<User | null> {
  const user = await userManager.getUser();
  if (user && user.refresh_token === failedRefreshToken) {
    await userManager.removeUser();
    return null;
  }
  return user;
}

/**
 * Renew the tokens with the refresh token. Concurrent callers share the same
 * request. Resolves the renewed user, or `null` when the renewal failed: the
 * stored user is kept if Keycloak was only unreachable, removed if it ended
 * the session.
 */
export function refreshSession(): Promise<User | null> {
  pendingRefresh ??= (async () => {
    const before = await userManager.getUser();
    try {
      return await userManager.signinSilent();
    } catch (error) {
      if (isSessionEnded(error)) {
        const user = await forgetEndedSession(before?.refresh_token);
        return user && !user.expired ? user : null;
      }
      console.warn('Session renewal failed, kept for a later attempt:', error);
      return null;
    } finally {
      pendingRefresh = null;
    }
  })();
  return pendingRefresh;
}

/** Renew the session if its access token is expired or about to expire. */
export async function renewIfNeeded(): Promise<void> {
  const user = await userManager.getUser();
  if (user?.refresh_token && (user.expires_in ?? 0) <= RENEW_BEFORE_SECONDS) {
    await refreshSession();
  }
}

/**
 * Access token for an API call, renewed first if it is about to expire.
 * `null` when nobody is signed in.
 */
export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser();
  if (!user) return null;
  if ((user.expires_in ?? 0) > MIN_VALIDITY_SECONDS) return user.access_token;
  // Renewal failed: send what is left (the call then fails like any other
  // offline call), unless the session was dropped meanwhile
  const renewed = (await refreshSession()) ?? (await userManager.getUser());
  return renewed?.access_token ?? null;
}
