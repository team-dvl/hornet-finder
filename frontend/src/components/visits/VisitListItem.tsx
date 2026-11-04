import { formatDateTime } from '../../utils/format';
import { visitLabel, type Visit } from '../../utils/visitsApi';

interface VisitListItemProps {
  visit: Visit;
  onOpen: (visit: Visit) => void;
  /** Leave out the apiary: the list is that of one apiary */
  inApiary?: boolean;
}

/** One row of a visit list: when, what, where, how many colonies were looked at. */
export default function VisitListItem({ visit, onOpen, inApiary = false }: VisitListItemProps) {
  const where = visit.apiary ? (visit.apiary.address || `Rucher #${visit.apiary.id}`) : visit.apiary_label;
  const count = visit.inspections.length;
  return (
    <button
      type="button"
      className="list-group-item list-group-item-action d-flex gap-2 align-items-start py-2 px-2"
      onClick={() => onOpen(visit)}
      aria-label={`Visite du ${formatDateTime(visit.started_at)}`}
    >
      <i className="bi bi-journal-text hive-icon fs-5 flex-shrink-0" aria-hidden="true" />
      <span className="d-block min-w-0 flex-grow-1">
        <strong className="d-block text-truncate">{visitLabel(visit)}</strong>
        <span className="d-block small text-muted text-truncate">
          {formatDateTime(visit.started_at)}
          {!inApiary && where && ` · ${where}`}
        </span>
        <span className="d-block small text-truncate">
          {count === 0 ? 'Aucune colonie notée' : count === 1 ? '1 colonie' : `${count} colonies`}
          {visit.photos.length > 0 && ` · ${visit.photos.length} photo${visit.photos.length > 1 ? 's' : ''}`}
        </span>
      </span>
    </button>
  );
}
