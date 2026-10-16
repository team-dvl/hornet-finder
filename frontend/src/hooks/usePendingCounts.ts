import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from 'react-oidc-context';
import { clearPending, getPending, loadPending, subscribePending, type PendingCounts } from '../utils/pending';

/** What waits for the signed-in user, by module (see `utils/pending.ts`); empty when signed out. */
export function usePendingCounts(): PendingCounts {
  const auth = useAuth();
  const counts = useSyncExternalStore(subscribePending, getPending);
  useEffect(() => {
    if (auth.isAuthenticated) void loadPending();
    else if (!auth.isLoading) clearPending();
  }, [auth.isAuthenticated, auth.isLoading]);
  return counts;
}
