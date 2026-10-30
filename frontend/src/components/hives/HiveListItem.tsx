import { Badge } from 'react-bootstrap';
import { HIVE_STATUS_LABELS, apiaryLabel, hiveLabel, type Hive } from '../../utils/hivesApi';

interface HiveListItemProps {
  hive: Hive;
  onOpen: (hive: Hive) => void;
  /** Leave out the apiary: the list is that of one apiary */
  inApiary?: boolean;
}

/** One row of a hive list: name and number, type, where it stands. */
export default function HiveListItem({ hive, onOpen, inApiary = false }: HiveListItemProps) {
  return (
    <button
      type="button"
      className="list-group-item list-group-item-action d-flex gap-2 align-items-start py-2 px-2"
      onClick={() => onOpen(hive)}
      aria-label={`Fiche de la ruche ${hiveLabel(hive)}`}
    >
      <i className="bi bi-hexagon-half hive-icon fs-4 flex-shrink-0" aria-hidden="true" />
      <span className="d-block min-w-0 flex-grow-1">
        <span className="d-flex flex-wrap align-items-center gap-1">
          <strong className="text-truncate">{hiveLabel(hive)}</strong>
          {hive.status !== 'active' && (
            <Badge bg={hive.status === 'retired' ? 'secondary' : 'warning'} text={hive.status === 'retired' ? undefined : 'dark'}>
              {HIVE_STATUS_LABELS[hive.status]}
            </Badge>
          )}
        </span>
        <span className="d-block small text-muted text-truncate">
          {hive.hive_type_name}
          {!inApiary && hive.apiary && ` · ${apiaryLabel(hive.apiary)}`}
        </span>
      </span>
    </button>
  );
}
