import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Form, Modal } from 'react-bootstrap';
import { useOverlayHistory } from '../../hooks/useOverlayHistory';

interface AppModalProps {
  show: boolean;
  onHide: () => void;
  title: ReactNode;
  /** Emoji or icon element shown before the title */
  icon?: ReactNode;
  /** Badges or short status shown after the title, on the same line */
  badges?: ReactNode;
  children: ReactNode;
  /** Action buttons only: the header close button is the one way to close */
  footer?: ReactNode;
  /** When set, body and footer form one `<form>` submitted by the footer */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Bootstrap validation state of that form; when set, the browser's own validation is off */
  validated?: boolean;
  /** Width from `sm` up; below, the dialog is always full screen */
  size?: 'sm' | 'lg' | 'xl';
  /** A small dialog (confirmation) that stays centred on a phone as well */
  compact?: boolean;
  /** Static backdrop, for dialogs that must not close by accident */
  locked?: boolean;
  bodyClassName?: string;
}

/**
 * Dialog of the application: full screen on a phone, scrollable body, footer
 * kept for actions, back-to-top button once the body scrolls past a screen,
 * back button / back swipe closes it. See "Mobile UX Guidelines" in CLAUDE.md.
 */
export default function AppModal({
  show, onHide, title, icon, badges, children, footer, onSubmit, validated, size, compact = false, locked = false,
  bodyClassName,
}: AppModalProps) {
  useOverlayHistory(show, onHide);

  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const handleScroll = useCallback(() => {
    if (body) setScrolled(body.scrollTop > body.clientHeight * 0.8);
  }, [body]);

  const content = (
    <>
      <Modal.Body ref={setBody} onScroll={handleScroll} className={bodyClassName}>
        {children}
        {scrolled && (
          <div className="back-to-top">
            <button
              type="button"
              className="btn btn-light shadow-sm rounded-circle"
              aria-label="Revenir en haut"
              title="Revenir en haut"
              onClick={() => body?.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <i className="bi bi-arrow-up" aria-hidden="true" />
            </button>
          </div>
        )}
      </Modal.Body>
      {footer && <Modal.Footer className="app-modal-footer">{footer}</Modal.Footer>}
    </>
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      scrollable
      size={size}
      fullscreen={compact ? undefined : 'sm-down'}
      backdrop={locked ? 'static' : true}
      className="app-modal"
    >
      <Modal.Header closeButton closeLabel="Fermer" className="app-modal-header">
        <Modal.Title as="h5" className="app-modal-title">
          {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
          <span className="text-truncate">{title}</span>
          {badges && <span className="d-flex gap-1 flex-shrink-0">{badges}</span>}
        </Modal.Title>
      </Modal.Header>
      {onSubmit ? (
        <Form noValidate={validated !== undefined} validated={validated} onSubmit={onSubmit}>{content}</Form>
      ) : content}
    </Modal>
  );
}
