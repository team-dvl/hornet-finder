import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Overlay, Popover } from 'react-bootstrap';
import type { DocRef } from '../../help/anchors';
import { helpJustClosed, openHelp } from '../../help/helpStore';
import { canHover } from '../../utils/overlayTrigger';

interface HelpTipProps {
  /** Unique id of the popover, for accessibility */
  id: string;
  title?: string;
  /** Documentation section behind this tip (`traps#journal`): adds a link to it, opening the help panel */
  doc?: DocRef;
  children: ReactNode;
}

/** Time the pointer has to cross the gap between the icon and its popover */
const HOVER_CLOSE_DELAY_MS = 250;

/**
 * Help icon opening an explanation on hover, or on tap/focus on a phone, so
 * the explanatory texts do not take room on the page. With `doc`, the popover
 * ends with a link to the full documentation (the help panel opens at that
 * section, over whatever is open); with a mouse, a click on the icon goes
 * there directly.
 */
export default function HelpTip({ id, title, doc, children }: HelpTipProps) {
  const icon = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);
  const [show, setShow] = useState(false);
  const hover = canHover();

  const cancelClose = () => window.clearTimeout(timer.current);
  const open = () => {
    cancelClose();
    setShow(true);
  };
  const closeSoon = () => {
    cancelClose();
    timer.current = window.setTimeout(() => setShow(false), HOVER_CLOSE_DELAY_MS);
  };
  const openDoc = () => {
    cancelClose();
    setShow(false);
    if (doc) openHelp(doc);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A tap elsewhere, or Escape, closes the popover
  useEffect(() => {
    if (!show) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!icon.current?.contains(node) && !document.getElementById(id)?.contains(node)) setShow(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShow(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [show, id]);

  const handleClick = () => {
    if (!hover) setShow((shown) => !shown);
    else if (doc) openDoc();
  };

  return (
    <>
      <button
        ref={icon}
        type="button"
        className="btn btn-link p-0 ms-2 align-baseline text-secondary lh-1"
        aria-label={title ?? 'Aide'}
        aria-expanded={show}
        onClick={handleClick}
        onMouseEnter={hover ? open : undefined}
        onMouseLeave={hover ? closeSoon : undefined}
        onFocus={hover ? () => { if (!helpJustClosed()) open(); } : undefined}
        onBlur={hover ? closeSoon : undefined}
      >
        <i className="bi bi-question-circle" aria-hidden="true" />
      </button>
      <Overlay target={icon} show={show} placement="auto" flip>
        <Popover
          id={id}
          onMouseEnter={hover ? cancelClose : undefined}
          onMouseLeave={hover ? closeSoon : undefined}
          onFocus={hover ? cancelClose : undefined}
          onBlur={hover ? closeSoon : undefined}
        >
          {title && <Popover.Header as="h3">{title}</Popover.Header>}
          <Popover.Body>{children}</Popover.Body>
          {doc && (
            <button type="button" className="help-tip-more" onClick={openDoc}>
              <i className="bi bi-book" aria-hidden="true" />
              Documentation complète
              <i className="bi bi-chevron-right ms-auto" aria-hidden="true" />
            </button>
          )}
        </Popover>
      </Overlay>
    </>
  );
}
