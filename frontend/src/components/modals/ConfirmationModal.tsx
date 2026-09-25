import { ConfirmDialog } from '../ui';

type ConfirmationAction = 'delete' | 'archive';

interface ConfirmationModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  /** Object as named in the question, e.g. "le piège #8" */
  itemName: string;
  action?: ConfirmationAction;
  isDeleting?: boolean;
  deleteError?: string | null;
}

const ACTIONS: Record<ConfirmationAction, {
  verb: string;
  message: string;
  confirmLabel: string;
  confirmIcon: string;
  variant: 'danger' | 'warning';
}> = {
  delete: {
    verb: 'Supprimer',
    message: 'Cette action est irréversible.',
    confirmLabel: 'Supprimer',
    confirmIcon: 'trash',
    variant: 'danger',
  },
  archive: {
    verb: 'Archiver',
    message: 'Il ne sera plus affiché par défaut, mais restera consultable dans les archives.',
    confirmLabel: 'Archiver',
    confirmIcon: 'archive',
    variant: 'warning',
  },
};

/** Confirmation of a deletion or an archiving, on top of ConfirmDialog. */
export default function ConfirmationModal({
  show, onHide, onConfirm, itemName, action = 'delete', isDeleting = false, deleteError = null,
}: ConfirmationModalProps) {
  const config = ACTIONS[action];
  return (
    <ConfirmDialog
      show={show}
      onHide={onHide}
      onConfirm={onConfirm}
      title={`${config.verb} ${itemName} ?`}
      message={config.message}
      confirmLabel={config.confirmLabel}
      confirmIcon={config.confirmIcon}
      variant={config.variant}
      busy={isDeleting}
      error={deleteError}
    />
  );
}
