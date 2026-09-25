import type { ReactNode } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import AppModal from './AppModal';

interface ConfirmDialogProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  /** The question, e.g. "Supprimer le piège #8 ?" */
  title: string;
  /** One short sentence, when the title does not say it all */
  message?: ReactNode;
  confirmLabel: string;
  /** bootstrap-icons name of the confirm button */
  confirmIcon?: string;
  variant?: 'danger' | 'warning' | 'primary';
  busy?: boolean;
  error?: string | null;
}

/**
 * Short confirmation. It replaces the dialog it comes from rather than
 * stacking on top of it: the caller hides its own dialog while this one is
 * shown (one dialog at a time).
 */
export default function ConfirmDialog({
  show, onHide, onConfirm, title, message, confirmLabel, confirmIcon, variant = 'danger', busy = false,
  error = null,
}: ConfirmDialogProps) {
  return (
    <AppModal
      show={show}
      onHide={onHide}
      compact
      title={title}
      footer={(
        <>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Annuler</Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy}>
            {busy
              ? <Spinner animation="border" size="sm" className="me-2" />
              : confirmIcon && <i className={`bi bi-${confirmIcon} me-2`} aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </>
      )}
    >
      {message && <p className="mb-0">{message}</p>}
      {error && <Alert variant="danger" className={message ? 'mt-3 mb-0' : 'mb-0'}>{error}</Alert>}
    </AppModal>
  );
}
