import type { Nest } from '../../store/store';
import { AuthImage } from '../common';
import { IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';
import { nestStatusInfo } from '../../utils/nestStatus';
import NestStatusBadge from './NestStatusBadge';

interface NestListItemProps {
  nest: Nest & { id: number };
  onOpen: (nest: Nest) => void;
  onLocate: (nest: Nest) => void;
  /** Opens the other actions (sheet) */
  onMore?: (nest: Nest) => void;
  /** The main action of the row, if any (e.g. "Signaler neutralisé") */
  action?: { label: string; onClick: (nest: Nest) => void };
  highlighted?: boolean;
}

/** What a row says under the number: when, where, how it stands. */
function summary(nest: Nest): string {
  const parts = [nest.created_at ? formatDate(nest.created_at) : null, nest.public_place ? 'public' : 'privé'];
  if (nest.status === 'destroyed' && nest.destroyed_at) parts.push(`neutralisé le ${formatDate(nest.destroyed_at)}`);
  const photos = nest.photos?.length ?? 0;
  if (photos) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
  return parts.filter(Boolean).join(' · ');
}

/** One row of a list of nests: identity, status and the quick actions. */
export default function NestListItem({ nest, onOpen, onLocate, onMore, action, highlighted }: NestListItemProps) {
  const thumbnail = nest.photos?.[0]?.thumbnail_url ?? null;
  return (
    // On a phone a row with a main action puts its buttons under the text, as the traps do
    <div className={`list-group-item manager-list-item d-flex${action ? ' flex-wrap flex-sm-nowrap' : ''} align-items-center column-gap-2 py-2 px-2${highlighted ? ' list-group-item-warning' : ''}`}>
      <button
        type="button"
        className="manager-list-open btn p-0 border-0 text-start d-flex gap-2 flex-grow-1 min-w-0"
        onClick={() => onOpen(nest)}
        aria-label={`Fiche du nid #${nest.id} (${nestStatusInfo(nest.status).label})`}
      >
        <span className="manager-list-thumb flex-shrink-0 rounded">
          {thumbnail ? <AuthImage src={thumbnail} alt="" className="rounded" /> : <span aria-hidden="true">{OBJECT_ICONS.nest}</span>}
        </span>
        <span className="d-block min-w-0">
          <span className="d-flex align-items-center gap-1 min-w-0">
            <strong className="flex-shrink-0">#{nest.id}</strong>
            {nest.address && <span className="text-truncate">{nest.address}</span>}
          </span>
          <span className="d-flex flex-wrap align-items-center column-gap-2 small text-muted">
            <NestStatusBadge status={nest.status} />
            <span className="text-truncate">{summary(nest)}</span>
          </span>
        </span>
      </button>

      <div className="manager-list-actions d-flex align-items-center flex-shrink-0">
        {action && (
          <button type="button" className="btn btn-outline-primary text-nowrap" onClick={() => action.onClick(nest)}>
            {action.label}
          </button>
        )}
        <IconButton
          variant="link"
          icon={ACTION_ICONS.showOnMap}
          label="Voir sur la carte"
          showLabel="never"
          onClick={() => onLocate(nest)}
        />
        {onMore && (
          <IconButton
            variant="link"
            className="text-body"
            icon={ACTION_ICONS.more}
            label="Plus d'actions"
            showLabel="never"
            onClick={() => onMore(nest)}
          />
        )}
      </div>
    </div>
  );
}
