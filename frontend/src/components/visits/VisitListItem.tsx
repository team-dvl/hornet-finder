import { Badge } from 'react-bootstrap';
import { formatDateTime } from '../../utils/format';
import { apiaryLabel } from '../../utils/hivesApi';
import { PLANNED_WHEN_LABELS, plannedWhen, visitLabel, type Visit } from '../../utils/visitsApi';

interface VisitListItemProps {
  visit: Visit;
  onOpen: (visit: Visit) => void;
  /** Leave out the apiary: the list is that of one apiary */
  inApiary?: boolean;
}

/** One row of a visit list: when, what, where, how many colonies were looked at. */
export default function VisitListItem({ visit, onOpen, inApiary = false }: VisitListItemProps) {
  const where = visit.apiary ? apiaryLabel(visit.apiary) : visit.apiary_label;
  const count = visit.inspections.length;
  const when = plannedWhen(visit);
  const planned = visit.status === 'planned';
  return (
    <button
      type="button"
      className="list-group-item list-group-item-action d-flex gap-2 align-items-start py-2 px-2"
      onClick={() => onOpen(visit)}
      aria-label={`Visite du ${formatDateTime(visit.started_at)}`}
    >
      <i className={`bi ${planned ? 'bi-calendar-event' : 'bi-journal-text'} hive-icon fs-5 flex-shrink-0`} aria-hidden="true" />
      <span className="d-block min-w-0 flex-grow-1">
        <span className="d-flex align-items-center gap-1 min-w-0">
          <strong className="text-truncate">{visitLabel(visit)}</strong>
          {when && (
            <Badge bg={when === 'late' ? 'danger' : when === 'today' ? 'warning' : 'secondary'}
              text={when === 'today' ? 'dark' : undefined} className="flex-shrink-0">
              {PLANNED_WHEN_LABELS[when]}
            </Badge>
          )}
        </span>
        <span className="d-block small text-muted text-truncate">
          {formatDateTime(visit.started_at)}
          {!inApiary && where && ` · ${where}`}
        </span>
        {planned ? (
          visit.participants.length > 0 && (
            <span className="d-block small text-truncate">
              <i className="bi bi-people me-1" aria-hidden="true" />
              {visit.participants.map((person) => person.display_name).join(', ')}
            </span>
          )
        ) : (
          <span className="d-block small text-truncate">
            {count === 0 ? 'Aucune colonie notée' : count === 1 ? '1 colonie' : `${count} colonies`}
            {visit.photos.length > 0 && ` · ${visit.photos.length} photo${visit.photos.length > 1 ? 's' : ''}`}
          </span>
        )}
      </span>
    </button>
  );
}
