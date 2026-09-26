import { ListGroup } from 'react-bootstrap';
import type { Apiary } from '../../store/store';
import { BottomSheet } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';

interface ApiaryActionsSheetProps {
  /** Apiary whose actions are offered; the sheet is closed when null */
  apiary: Apiary | null;
  onHide: () => void;
  onOpen: (apiary: Apiary) => void;
  onLocate: (apiary: Apiary) => void;
  onEdit: (apiary: Apiary) => void;
  onDelete: (apiary: Apiary) => void;
}

/** The less frequent actions of a row of the apiary manager, in a bottom sheet. */
export default function ApiaryActionsSheet({
  apiary, onHide, onOpen, onLocate, onEdit, onDelete,
}: ApiaryActionsSheetProps) {
  // What the user may do comes from the backend with each apiary
  const actions = apiary ? [
    { key: 'open', icon: ACTION_ICONS.sheet, label: 'Fiche et partage', onClick: () => onOpen(apiary) },
    { key: 'locate', icon: ACTION_ICONS.showOnMap, label: 'Voir sur la carte', onClick: () => onLocate(apiary) },
    ...(apiary.permissions?.update
      ? [{ key: 'edit', icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => onEdit(apiary) }]
      : []),
    ...(apiary.permissions?.delete
      ? [{ key: 'delete', icon: ACTION_ICONS.delete, label: 'Supprimer', onClick: () => onDelete(apiary), danger: true }]
      : []),
  ] : [];

  return (
    <BottomSheet show={apiary !== null} onHide={onHide} title={apiary ? `Rucher #${apiary.id}` : ''}>
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
