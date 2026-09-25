import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  deleteTrap, deleteTrapCatch, deleteTrapEvent, fetchTrapDetail, selectSelectedTrap, startMovingTrap,
  type Trap, type TrapEvent, type TrapEventKind,
} from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ClampedText } from '../common';
import { ConfirmationModal } from '../modals';
import { AppModal, FieldRow, IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDate, formatShortDateTime } from '../../utils/format';
import TrapDelegationPanel from './TrapDelegationPanel';
import TrapEventModal from './TrapEventModal';
import { eventKindInfo } from './eventKinds';
import TrapFormModal from './TrapFormModal';

interface TrapInfoPopupProps {
  show: boolean;
  onHide: () => void;
  trap: Trap | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
  /** Shows the trap on the map; offered when the sheet is opened from the trap list */
  onLocate?: (trap: Trap) => void;
  /** Moves the trap elsewhere than on this screen (the map module, from the trap list) */
  onMove?: (trap: Trap) => void;
}

/** Journal entries shown before "Voir plus" */
const JOURNAL_PAGE = 10;

const THUMBNAIL: React.CSSProperties = { height: 56, width: 56, objectFit: 'cover', borderRadius: 4 };

/** Head of a journal entry: icon, label, date, author and the delete button. */
function EntryHead({ icon, label, date, author, deleteLabel, onDelete }: {
  icon: string;
  label: string;
  date: string;
  author?: string;
  deleteLabel: string;
  onDelete?: () => void;
}) {
  return (
    <div className="d-flex align-items-start gap-2">
      <span className="flex-shrink-0" style={{ fontSize: '1.3rem', lineHeight: 1.2 }} aria-hidden="true">{icon}</span>
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex justify-content-between align-items-baseline gap-2">
          <strong className="small text-truncate">{label}</strong>
          <span className="text-muted flex-shrink-0" style={{ fontSize: '0.75rem' }}>{formatShortDateTime(date)}</span>
        </div>
        {author && <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>{author}</div>}
      </div>
      {onDelete && (
        <Button
          variant="link"
          className="text-danger p-0 flex-shrink-0 journal-delete"
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={onDelete}
        >
          <i className={`bi bi-${ACTION_ICONS.delete}`} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/** One entry of the trap journal. */
function EventRow({ event, canDelete, onDelete, onPreview }: {
  event: TrapEvent;
  canDelete: boolean;
  onDelete: (event: TrapEvent) => void;
  onPreview: (url: string) => void;
}) {
  const info = eventKindInfo(event.kind as TrapEventKind);
  return (
    <div className="py-2 border-bottom">
      <EntryHead
        icon={info.icon}
        label={info.label}
        date={event.performed_at}
        author={event.performed_by?.display_name}
        deleteLabel="Supprimer cette intervention"
        onDelete={canDelete ? () => onDelete(event) : undefined}
      />
      <div className="journal-detail">
        {event.comments && <div className="small mt-1">{event.comments}</div>}
        {event.photos.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mt-1">
            {event.photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.thumbnail_url ?? photo.url ?? ''}
                alt="Photo de l'intervention"
                role="button"
                onClick={() => photo.url && onPreview(photo.url)}
                style={THUMBNAIL}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Journal entries as displayed: the catch events recorded during one visit
 * (same batch) form one entry, every other event stands alone.
 */
function journalEntries(events: TrapEvent[]): TrapEvent[][] {
  const entries: TrapEvent[][] = [];
  const byBatch = new Map<string, TrapEvent[]>();
  events.forEach((event) => {
    if (!event.batch) {
      entries.push([event]);
      return;
    }
    const entry = byBatch.get(event.batch);
    if (entry) {
      entry.push(event);
    } else {
      const created = [event];
      byBatch.set(event.batch, created);
      entries.push(created);
    }
  });
  return entries;
}

/** One visit's catches: a small card per species, with its count. */
function CatchRow({ events, canDelete, onDelete, onPreview }: {
  events: TrapEvent[];
  canDelete: boolean;
  onDelete: (events: TrapEvent[]) => void;
  onPreview: (url: string) => void;
}) {
  const first = events[0];
  const info = eventKindInfo('catch');
  const total = events.reduce((sum, event) => sum + (event.quantity ?? 0), 0);
  const comments = events.map((event) => event.comments).filter(Boolean);
  return (
    <div className="py-2 border-bottom">
      <EntryHead
        icon={info.icon}
        label={`${info.label} — ${total} insecte${total > 1 ? 's' : ''}`}
        date={first.performed_at}
        author={first.performed_by?.display_name}
        deleteLabel="Supprimer cette capture"
        onDelete={canDelete ? () => onDelete(events) : undefined}
      />
      <div className="journal-detail d-flex flex-wrap gap-2 mt-1">
        {events.map((event) => {
          const photo = event.photos[0];
          const thumbnail = photo?.thumbnail_url ?? event.species?.photo_thumbnail_url ?? null;
          const name = event.species?.name ?? '';
          return (
            <div key={event.id} className="text-center" style={{ width: 64 }}>
              <div
                className="position-relative"
                role={photo?.url ? 'button' : undefined}
                onClick={() => photo?.url && onPreview(photo.url)}
                title={photo ? `Photo de la capture : ${name}` : name}
              >
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={name}
                    style={THUMBNAIL}
                    className={photo ? 'border border-2 border-success' : ''}
                  />
                ) : (
                  <span
                    className="d-inline-flex align-items-center justify-content-center bg-body-secondary"
                    style={{ ...THUMBNAIL, fontSize: '1.5rem' }}
                    aria-hidden="true"
                  >
                    🪲
                  </span>
                )}
                <Badge
                  pill
                  bg="danger"
                  className="position-absolute top-0 end-0"
                  style={{ transform: 'translate(25%, -25%)' }}
                >
                  {event.quantity}
                </Badge>
              </div>
              <div className="text-truncate" style={{ fontSize: '0.7rem' }} title={name}>{name}</div>
            </div>
          );
        })}
      </div>
      {comments.map((text) => <div key={text} className="journal-detail small mt-1">{text}</div>)}
    </div>
  );
}

/** Dialog shown in place of the sheet (one dialog at a time) */
type SubDialog =
  | { kind: 'event'; eventKind: TrapEventKind }
  | { kind: 'edit' }
  | { kind: 'delete' }
  | { kind: 'delete-entry'; entry: TrapEvent[] }
  | { kind: 'photo'; url: string };

/** Detail of a trap: identity, journal and the actions the user is allowed to take. */
export default function TrapInfoPopup({
  show, onHide, trap, onAddAtLocation, onLocate, onMove,
}: TrapInfoPopupProps) {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const detailed = useAppSelector(selectSelectedTrap);
  const { canEditTrap, canActOnTrap, isAdmin, userGuid } = useUserPermissions();

  const [sub, setSub] = useState<SubDialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalLength, setJournalLength] = useState(JOURNAL_PAGE);

  // The list only carries a summary; the journal comes with the detail
  useEffect(() => {
    if (show && trap && auth.isAuthenticated) {
      dispatch(fetchTrapDetail(trap.id));
    }
  }, [show, trap, auth.isAuthenticated, dispatch]);

  if (!trap) return null;

  // Prefer the detailed copy once it has arrived
  const current = detailed?.id === trap.id ? detailed : trap;
  const events = current.events ?? [];
  const entries = journalEntries(events);
  const mayEdit = canEditTrap(current);
  const mayAct = canActOnTrap(current);
  const closeSub = () => setSub(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await dispatch(deleteTrap(current.id)).unwrap();
      setSub(null);
      onHide();
    } catch (deleteError) {
      setError(deleteError as string);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteEntry = async (entry: TrapEvent[]) => {
    setError(null);
    const { batch, id } = entry[0];
    try {
      if (batch) {
        await dispatch(deleteTrapCatch({ trapId: current.id, batch })).unwrap();
      } else {
        await dispatch(deleteTrapEvent({ trapId: current.id, eventId: id })).unwrap();
      }
    } catch (deleteError) {
      setError(deleteError as string);
    } finally {
      setSub(null);
    }
  };

  const canDeleteEvent = (event: TrapEvent) =>
    isAdmin
    || (current.owner?.guid === userGuid)
    || (Boolean(event.performed_by) && event.performed_by?.guid === userGuid);

  const handleMove = () => {
    onHide();
    // Dragging the marker needs the map: on it, or in the map module
    if (onMove) onMove(current);
    else dispatch(startMovingTrap(current.id));
  };

  const preview = (url: string) => setSub({ kind: 'photo', url });
  const canAddHere = auth.isAuthenticated && onAddAtLocation;

  return (
    <>
      <AppModal
        show={show && sub === null}
        onHide={onHide}
        icon={OBJECT_ICONS.trap}
        title={current.trap_type.name}
        badges={(
          <Badge bg={current.active ? 'success' : 'secondary'} className="fs-6 fw-normal">
            {current.active ? 'En service' : 'Remisé'}
          </Badge>
        )}
      >
        {error && <Alert variant="danger">{error}</Alert>}

        {current.photo_url && (
          <img
            src={current.photo_url}
            alt="Photo du piège"
            role="button"
            onClick={() => preview(current.photo_url!)}
            className="w-100 mb-2 rounded"
            style={{ maxHeight: 160, objectFit: 'cover' }}
          />
        )}

        <div className="mb-2">
          <FieldRow label="Frelons asiatiques capturés"><strong>{current.hornet_catch_count}</strong></FieldRow>
          <FieldRow label="Installé le">{formatDate(current.installed_at)}</FieldRow>
          {current.owner && <FieldRow label="Propriétaire">{current.owner.display_name}</FieldRow>}
          {current.tag_short && <FieldRow label="QR Code"><code>{current.tag_short}</code></FieldRow>}
          {current.address && (
            <div className="text-muted small mt-1 d-flex gap-1">
              <i className="bi bi-geo-alt flex-shrink-0" aria-hidden="true" />
              <ClampedText id={`trap-${current.id}-address`} text={current.address} lines={2} />
            </div>
          )}
          {current.comments && <p className="small mt-1 mb-0">{current.comments}</p>}
        </div>

        {!auth.isAuthenticated && (
          <Alert variant="light" className="small mb-0">
            Connectez-vous pour consulter le journal de ce piège.
          </Alert>
        )}

        {auth.isAuthenticated && (
          <>
            {(mayAct || mayEdit || canAddHere || onLocate) && (
              <div className="sheet-actions mb-3">
                {mayAct && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => setSub({ kind: 'event', eventKind: 'catch' })}
                      aria-label="Enregistrer une capture"
                    >
                      <span className="me-2" aria-hidden="true">🐝</span>
                      Capture
                    </Button>
                    <IconButton
                      variant="outline-primary"
                      icon={ACTION_ICONS.action}
                      label="Ajouter une action"
                      onClick={() => setSub({ kind: 'event', eventKind: 'inspection' })}
                    />
                  </>
                )}
                {onLocate && (
                  <IconButton
                    variant="outline-secondary"
                    icon="geo-alt"
                    label="Voir sur la carte"
                    onClick={() => onLocate(current)}
                  />
                )}
                {mayEdit && (
                  <>
                    <IconButton variant="outline-secondary" icon={ACTION_ICONS.move} label="Déplacer" onClick={handleMove} />
                    <IconButton
                      variant="outline-secondary"
                      icon={ACTION_ICONS.edit}
                      label="Modifier"
                      onClick={() => setSub({ kind: 'edit' })}
                    />
                  </>
                )}
                {canAddHere && (
                  <IconButton
                    variant="outline-secondary"
                    icon={ACTION_ICONS.addHere}
                    label="Ajouter à cette position"
                    onClick={() => onAddAtLocation(current.latitude, current.longitude)}
                  />
                )}
                {mayEdit && (
                  <IconButton
                    variant="outline-danger"
                    icon={ACTION_ICONS.delete}
                    label="Supprimer"
                    className="ms-auto"
                    onClick={() => setSub({ kind: 'delete' })}
                  />
                )}
              </div>
            )}

            <h6 className="mb-1">
              Journal
              {entries.length > 0 && <Badge bg="light" text="dark" className="ms-2">{entries.length}</Badge>}
            </h6>
            {events.length === 0 ? (
              <p className="text-muted small">
                {current.events ? 'Aucune intervention enregistrée.' : <Spinner animation="border" size="sm" />}
              </p>
            ) : (
              <div className="trap-journal mb-2">
                {entries.slice(0, journalLength).map((entry) => (entry[0].kind === 'catch' ? (
                  <CatchRow
                    key={entry[0].id}
                    events={entry}
                    canDelete={entry.every(canDeleteEvent)}
                    onDelete={(items) => setSub({ kind: 'delete-entry', entry: items })}
                    onPreview={preview}
                  />
                ) : (
                  <EventRow
                    key={entry[0].id}
                    event={entry[0]}
                    canDelete={canDeleteEvent(entry[0])}
                    onDelete={(event) => setSub({ kind: 'delete-entry', entry: [event] })}
                    onPreview={preview}
                  />
                )))}
                {entries.length > journalLength && (
                  <Button variant="link" className="w-100" onClick={() => setJournalLength((length) => length + JOURNAL_PAGE)}>
                    Voir plus ({entries.length - journalLength})
                  </Button>
                )}
              </div>
            )}

            <TrapDelegationPanel trap={current} />
          </>
        )}
      </AppModal>

      {sub?.kind === 'event' && (
        <TrapEventModal onHide={closeSub} trap={current} initialKind={sub.eventKind} />
      )}

      {sub?.kind === 'edit' && <TrapFormModal onHide={closeSub} trap={current} />}

      <ConfirmationModal
        show={sub?.kind === 'delete'}
        onHide={closeSub}
        onConfirm={handleDelete}
        itemName={`le piège #${current.id}`}
        isDeleting={deleting}
        deleteError={error}
      />

      <ConfirmationModal
        show={sub?.kind === 'delete-entry'}
        onHide={closeSub}
        onConfirm={() => sub?.kind === 'delete-entry' && handleDeleteEntry(sub.entry)}
        itemName={sub?.kind === 'delete-entry' && sub.entry[0].kind === 'catch' ? 'cette capture' : 'cette intervention'}
      />

      {/* Agrandissement d'une photo */}
      <AppModal
        show={sub?.kind === 'photo'}
        onHide={closeSub}
        title="Photo"
        size="lg"
        bodyClassName="p-0 d-flex align-items-center bg-dark"
      >
        {sub?.kind === 'photo' && <img src={sub.url} alt="Photo" className="w-100" />}
      </AppModal>
    </>
  );
}
