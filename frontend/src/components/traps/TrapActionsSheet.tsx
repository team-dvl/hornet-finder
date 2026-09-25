import { ListGroup } from 'react-bootstrap';
import type { Trap } from '../../store/store';
import { BottomSheet } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';

interface TrapActionsSheetProps {
  /** Trap whose actions are offered; the sheet is closed when null */
  trap: Trap | null;
  onHide: () => void;
  /** Owner or platform admin: move, edit, delete */
  canEdit: boolean;
  onOpen: (trap: Trap) => void;
  onLocate: (trap: Trap) => void;
  onMove: (trap: Trap) => void;
  onEdit: (trap: Trap) => void;
  onDelete: (trap: Trap) => void;
}

/** The less frequent actions of a row of the trap manager, in a bottom sheet. */
export default function TrapActionsSheet({
  trap, onHide, canEdit, onOpen, onLocate, onMove, onEdit, onDelete,
}: TrapActionsSheetProps) {
  const actions = trap ? [
    { key: 'open', icon: ACTION_ICONS.sheet, label: 'Fiche et journal', onClick: () => onOpen(trap) },
    { key: 'locate', icon: ACTION_ICONS.showOnMap, label: 'Voir sur la carte', onClick: () => onLocate(trap) },
    ...(canEdit ? [
      { key: 'move', icon: ACTION_ICONS.move, label: 'Déplacer', onClick: () => onMove(trap) },
      { key: 'edit', icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => onEdit(trap) },
      { key: 'delete', icon: ACTION_ICONS.delete, label: 'Supprimer', onClick: () => onDelete(trap), danger: true },
    ] : []),
  ] : [];

  return (
    <BottomSheet show={trap !== null} onHide={onHide} title={trap ? `Piège #${trap.id} · ${trap.trap_type.name}` : ''}>
      <ListGroup variant="flush">
        {actions.map((action) => (
          <ListGroup.Item
            key={action.key}
            action
            onClick={action.onClick}
            className={`d-flex align-items-center gap-3 px-1 py-2 ${'danger' in action ? 'text-danger' : ''}`}
          >
            <i className={`bi bi-${action.icon} fs-5 flex-shrink-0`} aria-hidden="true" />
            {action.label}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </BottomSheet>
  );
}
