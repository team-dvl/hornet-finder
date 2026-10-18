import { ListGroup } from 'react-bootstrap';
import type { Trap } from '../../store/store';
import { BottomSheet } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';

interface TrapActionsSheetProps {
  /** Trap whose actions are offered; the sheet is closed when null */
  trap: Trap | null;
  onHide: () => void;
  onOpen: (trap: Trap) => void;
  onLocate: (trap: Trap) => void;
  onMove: (trap: Trap) => void;
  onEdit: (trap: Trap) => void;
  onDelete: (trap: Trap) => void;
  onChangeOwner: (trap: Trap) => void;
  onServiceChange?: (trap: Trap) => void;
}

/** The less frequent actions of a row of the trap manager, in a bottom sheet; what the user may do comes from `permissions`. */
export default function TrapActionsSheet({
  trap, onHide, onOpen, onLocate, onMove, onEdit, onDelete, onChangeOwner, onServiceChange,
}: TrapActionsSheetProps) {
  const permissions = trap?.permissions;
  const actions = trap ? [
    { key: 'open', icon: ACTION_ICONS.sheet, label: 'Fiche et journal', onClick: () => onOpen(trap) },
    { key: 'locate', icon: ACTION_ICONS.showOnMap, label: 'Voir sur la carte', onClick: () => onLocate(trap) },
    // Out of service, a trap has no reminder: the way to stop them for the winter
    ...(permissions?.act && onServiceChange ? [trap.active
      ? { key: 'shelve', icon: ACTION_ICONS.shelve, label: 'Remiser', onClick: () => onServiceChange(trap) }
      : { key: 'unshelve', icon: ACTION_ICONS.unshelve, label: 'Remettre en service', onClick: () => onServiceChange(trap) },
    ] : []),
    ...(permissions?.update ? [
      { key: 'move', icon: ACTION_ICONS.move, label: 'Déplacer', onClick: () => onMove(trap) },
      { key: 'edit', icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => onEdit(trap) },
    ] : []),
    ...(permissions?.change_owner
      ? [{ key: 'owner', icon: ACTION_ICONS.transfer, label: 'Changer de propriétaire', onClick: () => onChangeOwner(trap) }]
      : []),
    ...(permissions?.update ? [
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
