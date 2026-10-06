import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { renewIfNeeded } from '../utils/oidc';

/** Longest wait for the launch renewal before the app renders anyway. */
const LAUNCH_WAIT_MS = 5000;

/**
 * Keep the session alive where the library's renewal timer cannot: a phone
 * suspends the app, so its timer never fires while the app is closed or in
 * the background, and it never renews a token that had already expired when
 * the app was opened. The session is renewed with the refresh token on launch,
 * when the app comes back to the foreground and when the network comes back.
 *
 * Returns `true` while the launch renewal runs (at most `LAUNCH_WAIT_MS`), so
 * the app does not render a signed-out state for a session about to come back.
 */
export function useSessionGuard(): boolean {
  const { isLoading } = useAuth();
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (isLoading || launched) return;
    let cancelled = false;
    const timeout = new Promise((resolve) => setTimeout(resolve, LAUNCH_WAIT_MS));
    void Promise.race([renewIfNeeded(), timeout]).finally(() => {
      if (!cancelled) setLaunched(true);
    });
    return () => { cancelled = true; };
  }, [isLoading, launched]);

  useEffect(() => {
    // Copy of the profile left by the former session hook
    localStorage.removeItem('hornet-auth-state');

    const resume = () => {
      if (document.visibilityState === 'visible') void renewIfNeeded();
    };
    document.addEventListener('visibilitychange', resume);
    // Page restored from the back-forward cache
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
    };
  }, []);

  return !launched;
}
