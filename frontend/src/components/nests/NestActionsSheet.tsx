import { ListGroup } from 'react-bootstrap';
import type { Nest } from '../../store/store';
import { BottomSheet } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';

interface NestActionsSheetProps {
  /** Nest whose actions are offered; the sheet is closed when null */
  nest: Nest | null;
  onHide: () => void;
  onOpen: (nest: Nest) => void;
  onLocate: (nest: Nest) => void;
  onVisit: (nest: Nest) => void;
  onDestruction: (nest: Nest) => void;
  onChangeOwner: (nest: Nest) => void;
}

/** The actions of a row of the nest list, in a bottom sheet; what the user may do comes from `permissions`. */
export default function NestActionsSheet({ nest, onHide, onOpen, onLocate, onVisit, onDestruction, onChangeOwner }: NestActionsSheetProps) {
  const permissions = nest?.permissions;
  const actions = nest ? [
    { key: 'open', icon: ACTION_ICONS.sheet, label: 'Fiche et journal', onClick: () => onOpen(nest) },
    { key: 'locate', icon: ACTION_ICONS.showOnMap, label: 'Voir sur la carte', onClick: () => onLocate(nest) },
    ...(permissions?.visit ? [{ key: 'visit', icon: 'search', label: 'Vérifier', onClick: () => onVisit(nest) }] : []),
    ...(permissions?.destroy ? [{
      key: 'destruction',
      icon: 'check2-circle',
      label: permissions.visit ? 'Enregistrer la neutralisation' : 'Signaler la neutralisation',
      onClick: () => onDestruction(nest),
    }] : []),
    ...(permissions?.change_owner
      ? [{ key: 'owner', icon: ACTION_ICONS.transfer, label: 'Transférer', onClick: () => onChangeOwner(nest) }]
      : []),
  ] : [];

  return (
    <BottomSheet show={nest !== null} onHide={onHide} title={nest ? `Nid #${nest.id}` : ''}>
      <ListGroup variant="flush">
        {actions.map((action) => (
          <ListGroup.Item
            key={action.key}
            action
            onClick={action.onClick}
            className="d-flex align-items-center gap-3 px-1 py-2"
          >
            <i className={`bi bi-${action.icon} fs-5 flex-shrink-0`} aria-hidden="true" />
            {action.label}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </BottomSheet>
  );
}
