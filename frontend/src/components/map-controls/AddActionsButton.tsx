import { useState } from 'react';
import { ListGroup } from 'react-bootstrap';
import { BottomSheet } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';

interface AddActionsButtonProps {
  /** Hornet seen from here: position and compass direction */
  onQuickHornetCapture?: () => void;
  onAddTrap?: () => void;
  onScanTag?: () => void;
}

/**
 * The "+" map button: the additions that do not start from a point of the
 * map (a tap on the map offers the others, at that point).
 */
export default function AddActionsButton({ onQuickHornetCapture, onAddTrap, onScanTag }: AddActionsButtonProps) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const actions = [
    onQuickHornetCapture && {
      key: 'hornet', icon: <span aria-hidden="true">{OBJECT_ICONS.hornet}</span>, label: 'Frelon vu d\'ici',
      hint: 'Ma position et la direction de vol à la boussole', onClick: onQuickHornetCapture,
    },
    onAddTrap && {
      key: 'trap', icon: <span aria-hidden="true">{OBJECT_ICONS.trap}</span>, label: 'Piège',
      hint: 'Par son adresse', onClick: onAddTrap,
    },
    onScanTag && {
      key: 'scan', icon: <i className="bi bi-qr-code-scan" aria-hidden="true" />, label: 'Scanner un QR Code',
      hint: "Ouvrir l'objet qui le porte", onClick: onScanTag,
    },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; hint: string; onClick: () => void }[];

  if (actions.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="map-fab map-fab-primary"
        onClick={() => setOpen(true)}
        aria-label="Ajouter"
        title="Ajouter"
      >
        <i className="bi bi-plus-lg" aria-hidden="true" />
      </button>

      <BottomSheet show={open} onHide={() => setOpen(false)} title="Ajouter">
        <ListGroup variant="flush">
          {actions.map((action) => (
            <ListGroup.Item key={action.key} action onClick={run(action.onClick)} className="d-flex align-items-center gap-3 px-1 py-2">
              <span className="fs-4 text-center flex-shrink-0" style={{ width: '2rem' }}>{action.icon}</span>
              <span className="min-w-0">
                <span className="d-block fw-semibold">{action.label}</span>
                <span className="d-block small text-muted">{action.hint}</span>
              </span>
            </ListGroup.Item>
          ))}
        </ListGroup>
        <p className="small text-muted mt-2 mb-0">
          <i className="bi bi-hand-index me-1" aria-hidden="true" />
          Pour placer un objet ailleurs, touchez la carte à cet endroit.
        </p>
      </BottomSheet>
    </>
  );
}
