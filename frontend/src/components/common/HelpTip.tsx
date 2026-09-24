import type { ReactNode } from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { helpOverlayTrigger } from '../../utils/overlayTrigger';

interface HelpTipProps {
  /** Unique id of the popover, for accessibility */
  id: string;
  title?: string;
  children: ReactNode;
}

/**
 * Help icon opening an explanation on hover, or on tap/focus on a phone, so
 * the explanatory texts do not take room on the page.
 */
export default function HelpTip({ id, title, children }: HelpTipProps) {
  return (
    <OverlayTrigger
      trigger={helpOverlayTrigger()}
      rootClose
      placement="auto"
      overlay={
        <Popover id={id}>
          {title && <Popover.Header as="h3">{title}</Popover.Header>}
          <Popover.Body>{children}</Popover.Body>
        </Popover>
      }
    >
      <button type="button" className="btn btn-link p-0 ms-2 align-baseline text-secondary lh-1" aria-label={title ?? 'Aide'}>
        <i className="bi bi-question-circle" aria-hidden="true" />
      </button>
    </OverlayTrigger>
  );
}
