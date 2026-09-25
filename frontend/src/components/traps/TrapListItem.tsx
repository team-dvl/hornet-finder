import { Badge } from 'react-bootstrap';
import type { Trap } from '../../store/store';
import { IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDistance } from '../../utils/format';
import { OVERDUE_DAYS, daysSince, distanceKm } from './trapListUtils';

function lastVisitLabel(days: number | null): string {
  if (days === null) return 'Jamais relevé';
  if (days === 0) return "Relevé aujourd'hui";
  if (days === 1) return 'Relevé hier';
  return `Relevé il y a ${days} j`;
}

interface TrapListItemProps {
  trap: Trap;
  isMine: boolean;
  canAct: boolean;
  /** Position of the user, to show how far the trap is */
  origin?: { lat: number; lon: number } | null;
  onOpen: (trap: Trap) => void;
  onLocate: (trap: Trap) => void;
  onRecord: (trap: Trap) => void;
  /** Opens the other actions (sheet, move, edit, delete) */
  onMore: (trap: Trap) => void;
}

/** One row of the trap manager: identity, status and the quick actions. */
export default function TrapListItem({
  trap, isMine, canAct, origin, onOpen, onLocate, onRecord, onMore,
}: TrapListItemProps) {
  const days = daysSince(trap.last_event_at);
  const overdue = trap.active && (days === null || days > OVERDUE_DAYS);
  const thumbnail = trap.photo_thumbnail_url ?? trap.trap_type.photo_thumbnail_url ?? null;

  return (
    <div className="list-group-item trap-list-item d-flex flex-wrap flex-sm-nowrap column-gap-2 align-items-start py-2 px-2">
      <button
        type="button"
        className="trap-list-open btn p-0 border-0 text-start d-flex gap-2 flex-grow-1 min-w-0"
        onClick={() => onOpen(trap)}
        aria-label={`Fiche du piège #${trap.id}`}
      >
        <span className="trap-list-thumb flex-shrink-0 rounded">
          {thumbnail ? <img src={thumbnail} alt="" className="rounded" /> : <span aria-hidden="true">🪤</span>}
        </span>
        <span className="d-block min-w-0">
          <span className="d-flex flex-wrap align-items-center gap-1">
            <strong>#{trap.id}</strong>
            <span className="text-truncate">{trap.trap_type.name}</span>
            {!trap.active && <Badge bg="secondary">Remisé</Badge>}
            {trap.group && (
              <Badge bg="info" text="dark" className="text-truncate trap-list-group" title={trap.group.path}>
                <i className="bi bi-people-fill me-1" aria-hidden="true" />{trap.group.name}
              </Badge>
            )}
            {trap.visibility === 'group' && (
              <i className="bi bi-lock-fill text-muted" title="Visible du groupe seulement" aria-label="Visible du groupe seulement" />
            )}
          </span>
          {trap.address && <span className="d-block small text-muted text-truncate">{trap.address}</span>}
          {!isMine && trap.owner && (
            <span className="d-block small text-muted text-truncate">{trap.owner.display_name}</span>
          )}
          <span className="small d-flex flex-wrap column-gap-3">
            <span title="Frelons asiatiques capturés">🐝 {trap.hornet_catch_count}</span>
            <span className={overdue ? 'text-warning-emphasis fw-semibold' : 'text-muted'}>
              {lastVisitLabel(days)}
            </span>
            {trap.tag_short
              ? <code title="QR Code">{trap.tag_short}</code>
              : <span className="text-muted fst-italic">sans QR Code</span>}
            {origin && (
              <span className="text-muted">
                {formatDistance(distanceKm(origin.lat, origin.lon, trap.latitude, trap.longitude) * 1000)}
              </span>
            )}
          </span>
        </span>
      </button>

      <div className="trap-list-actions d-flex flex-shrink-0">
        <IconButton
          variant="link"
          icon={ACTION_ICONS.showOnMap}
          label="Voir sur la carte"
          showLabel="never"
          onClick={() => onLocate(trap)}
        />
        {canAct && (
          <IconButton
            variant="link"
            icon={ACTION_ICONS.catch}
            label="Enregistrer une capture"
            showLabel="never"
            onClick={() => onRecord(trap)}
          />
        )}
        <IconButton
          variant="link"
          className="text-body"
          icon={ACTION_ICONS.more}
          label="Plus d'actions"
          showLabel="never"
          onClick={() => onMore(trap)}
        />
      </div>
    </div>
  );
}
