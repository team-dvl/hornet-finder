import type { OverlayTriggerType } from 'react-bootstrap/esm/OverlayTrigger';

/**
 * Trigger of a help overlay: hover and focus with a mouse, a tap on a touch
 * screen (iOS does not focus a tapped button, so focus alone never fires).
 */
export function helpOverlayTrigger(): OverlayTriggerType[] {
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
  return canHover ? ['hover', 'focus'] : ['click'];
}
