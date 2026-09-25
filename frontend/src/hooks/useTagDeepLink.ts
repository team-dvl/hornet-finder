import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { resolveTag, TagError, type TagResolution } from '../utils/tagsApi';

const TAG_PATH = /^\/tag\/([^/]+)\/?$/;

interface TagDeepLinkHandlers {
  onResolved: (value: string, resolution: TagResolution) => void;
  onError: (message: string) => void;
  /** Where to go once the tag is resolved; the trap manager by default */
  returnTo?: string;
}

/**
 * Handles `/tag/<value>`, reached either from a QR code scanned outside the
 * app (captured by the installed PWA on Android) or from the in-app scanner.
 * Once signed in, the tag is resolved by the server and the URL goes back to
 * `returnTo` (the trap manager), so a reload does not replay the scan.
 *
 * Returns whether a sign-in is needed first, and whether a lookup is running.
 */
export function useTagDeepLink({ onResolved, onError, returnTo = '/traps' }: TagDeepLinkHandlers) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const value = TAG_PATH.exec(location.pathname)?.[1] ?? null;
  // Navigation (by its key) whose tag has been looked up; any other one with a
  // tag in its path is still being resolved
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const locationKey = location.key;

  const handlers = useRef({ onResolved, onError, returnTo });
  useEffect(() => {
    handlers.current = { onResolved, onError, returnTo };
  }, [onResolved, onError, returnTo]);

  useEffect(() => {
    if (!value || auth.isLoading || !auth.isAuthenticated) return;
    let cancelled = false;
    resolveTag(value)
      .then((resolution) => { if (!cancelled) handlers.current.onResolved(value, resolution); })
      .catch((error: unknown) => {
        if (!cancelled) handlers.current.onError(error instanceof TagError ? error.message : String(error));
      })
      .finally(() => {
        if (cancelled) return;
        setSettledKey(locationKey);
        navigate(handlers.current.returnTo, { replace: true });
      });
    return () => { cancelled = true; };
  }, [value, locationKey, auth.isLoading, auth.isAuthenticated, navigate]);

  const signedIn = !auth.isLoading && auth.isAuthenticated;
  return {
    needsSignIn: Boolean(value) && !auth.isLoading && !auth.isAuthenticated,
    resolving: Boolean(value) && signedIn && settledKey !== locationKey,
  };
}
