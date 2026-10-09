import { useEffect, useSyncExternalStore } from 'react';
import {
  getReachability,
  startReachabilityMonitor,
  subscribeReachability,
  type ReachabilityState,
} from '../utils/reachability';

/** Reachability of the server (see `utils/reachability.ts`), shared by the whole app. */
export function useReachability(): ReachabilityState {
  return useSyncExternalStore(subscribeReachability, getReachability);
}

/** Start the probes of the server's reachability; call once, from the root component. */
export function useReachabilityMonitor(): void {
  useEffect(() => {
    startReachabilityMonitor();
  }, []);
}
