import type { NestEvent } from '../../store/store';
import { AuthImage } from '../common';
import { IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDate } from '../../utils/format';
import { nestEventDetails, nestEventTitle } from '../../utils/nestStatus';

interface NestJournalProps {
  events: NestEvent[];
  onDelete: (event: NestEvent) => void;
}

/** The journal of a nest, newest first: who did what, when. */
export default function NestJournal({ events, onDelete }: NestJournalProps) {
  if (events.length === 0) return null;
  return (
    <section className="mt-3" aria-label="Journal">
      <h2 className="h6 text-uppercase text-muted mb-1">Journal</h2>
      <ul className="list-unstyled nest-journal mb-0">
        {events.map((event) => {
          const { icon, title } = nestEventTitle(event);
          const details = nestEventDetails(event);
          const date = event.kind === 'destruction' && event.details.date_unknown ? null : formatDate(event.performed_at);
          return (
            <li key={event.id} className="d-flex gap-2 py-2 border-bottom">
              <span className="nest-journal-icon flex-shrink-0" aria-hidden="true">{icon}</span>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold">{title}</div>
                <div className="small text-muted">
                  {[date, event.performed_by?.display_name, ...details].filter(Boolean).join(' · ')}
                </div>
                {event.comments && <div className="small mt-1">{event.comments}</div>}
                {event.photos.length > 0 && (
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {event.photos.map((photo) => (
                      <AuthImage key={photo.id} src={photo.thumbnail_url ?? photo.url ?? ''} alt=""
                        className="nest-journal-photo rounded" />
                    ))}
                  </div>
                )}
              </div>
              {event.can_delete && (
                <IconButton
                  variant="link"
                  className="text-muted flex-shrink-0"
                  icon={ACTION_ICONS.delete}
                  label="Supprimer cette entrée"
                  showLabel="never"
                  onClick={() => onDelete(event)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
