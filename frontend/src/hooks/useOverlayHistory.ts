import { useEffect, useRef } from 'react';
import { registerOverlay } from '../utils/overlayHistory';

/**
 * While `open`, the back button / back swipe calls `onClose` instead of
 * leaving the page. Used by AppModal and BottomSheet.
 */
export function useOverlayHistory(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    return registerOverlay(() => closeRef.current());
  }, [open]);
}
