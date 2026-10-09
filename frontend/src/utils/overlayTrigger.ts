import type { OverlayTriggerType } from 'react-bootstrap/esm/OverlayTrigger';

/** Whether the main pointer can hover (a mouse), as opposed to a touch screen. */
export function canHover(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover)').matches);
}

/**
 * Trigger of a help overlay: hover and focus with a mouse, a tap on a touch
 * screen (iOS does not focus a tapped button, so focus alone never fires).
 */
export function helpOverlayTrigger(): OverlayTriggerType[] {
  return canHover() ? ['hover', 'focus'] : ['click'];
}
