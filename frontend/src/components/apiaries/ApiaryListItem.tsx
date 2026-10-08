import { Badge } from 'react-bootstrap';
import type { Apiary } from '../../store/store';
import { AfscaNumber, AuthImage } from '../common';
import { IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { INFESTATION_LABELS } from './apiaryLevels';

interface ApiaryListItemProps {
  apiary: Apiary & { id: number };
  isMine: boolean;
  onOpen: (apiary: Apiary) => void;
  onLocate: (apiary: Apiary) => void;
  /** Opens the other actions (sheet, edit, delete) */
  onMore: (apiary: Apiary) => void;
}

/** One row of the apiary manager: identity, infestation, sharing and the quick actions. */
export default function ApiaryListItem({
  apiary, isMine, onOpen, onLocate, onMore,
}: ApiaryListItemProps) {
  const groups = apiary.extended_permissions ?? [];

  return (
    <div className="list-group-item manager-list-item d-flex flex-wrap flex-sm-nowrap column-gap-2 align-items-start py-2 px-2">
      <button
        type="button"
        className="manager-list-open btn p-0 border-0 text-start d-flex gap-2 flex-grow-1 min-w-0"
        onClick={() => onOpen(apiary)}
        aria-label={`Fiche du rucher #${apiary.id}`}
      >
        <span className="manager-list-thumb flex-shrink-0 rounded">
          {apiary.photo_thumbnail_url
            ? <AuthImage src={apiary.photo_thumbnail_url} className="rounded" />
            : <span aria-hidden="true">{OBJECT_ICONS.apiary}</span>}
        </span>
        <span className="d-block min-w-0">
          <span className="d-flex flex-wrap align-items-center gap-1">
            <strong>#{apiary.id}</strong>
            {apiary.infestation_level !== null && (
              <Badge bg="none" className={`infestation-badge infestation-badge-${apiary.infestation_level}`}>
                {INFESTATION_LABELS[apiary.infestation_level]}
              </Badge>
            )}
            {groups.length > 0 && (
              <Badge
                bg="info"
                text="dark"
                className="text-truncate manager-list-group"
                title={groups.map((grant) => grant.group).join(', ')}
              >
                <i className="bi bi-people-fill me-1" aria-hidden="true" />
                {groups[0].group_name || groups[0].group}
                {groups.length > 1 && ` +${groups.length - 1}`}
              </Badge>
            )}
          </span>
          {apiary.address && <span className="d-block small text-muted text-truncate">{apiary.address}</span>}
          {!isMine && apiary.owner && (
            <span className="d-block small text-muted text-truncate">{apiary.owner.display_name}</span>
          )}
          {/* No distance to the apiary: its position is sensitive */}
          {apiary.afsca_number && (
            <span className="d-block small text-truncate"><AfscaNumber value={apiary.afsca_number} /></span>
          )}
        </span>
      </button>

      <div className="manager-list-actions d-flex flex-shrink-0">
        <IconButton
          variant="link"
          icon={ACTION_ICONS.showOnMap}
          label="Voir sur la carte"
          showLabel="never"
          onClick={() => onLocate(apiary)}
        />
        <IconButton
          variant="link"
          className="text-body"
          icon={ACTION_ICONS.more}
          label="Plus d'actions"
          showLabel="never"
          onClick={() => onMore(apiary)}
        />
      </div>
    </div>
  );
}
