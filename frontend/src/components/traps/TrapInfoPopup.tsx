import { useEffect, useState } from 'react';
import { Accordion, Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  deleteTrap, deleteTrapCatch, deleteTrapEvent, fetchTrapDetail, selectSelectedTrap, startMovingTrap,
  type Trap, type TrapEvent, type TrapEventKind,
} from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useHistoryAction } from '../../hooks/useHistoryAction';
import { AuthImage, ClampedText } from '../common';
import { ConfirmationModal } from '../modals';
import { AppModal, FieldRow, IconButton, SheetActions } from '../ui';
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
              <AuthImage
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
 * Journal entries as displayed: the events recorded during one visit (same
 * batch: the reading and the actions done with it) form one entry, every
 * other event stands alone.
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

/** Whether a journal entry is a visit with a reading, rather than a lone action */
function isReading(entry: TrapEvent[]): boolean {
  return entry.some((event) => event.kind === 'catch');
}

/**
 * One visit: a small card per species found, with its new catches, then the
 * actions done at the same time. A reading without any catch says so in its
 * title. In a trap that accumulates, a card also tells what the trap held when
 * that differs from the new catches, and the entry whether it was emptied.
 */
function VisitRow({ events, accumulates, canDelete, onDelete, onPreview }: {
  events: TrapEvent[];
  accumulates: boolean;
  canDelete: boolean;
  onDelete: (events: TrapEvent[]) => void;
  onPreview: (url: string) => void;
}) {
  const catches = events.filter((event) => event.kind === 'catch');
  const actions = events.filter((event) => event.kind !== 'catch');
  const first = catches[0];
  const info = eventKindInfo('catch');
  const total = catches.reduce((sum, event) => sum + (event.quantity ?? 0), 0);
  const comments = events.map((event) => event.comments).filter(Boolean);
  return (
    <div className="py-2 border-bottom">
      <EntryHead
        icon={info.icon}
        label={`${info.label} — ${total === 0 ? 'aucune capture' : `${total} insecte${total > 1 ? 's' : ''}`}`}
        date={first.performed_at}
        author={first.performed_by?.display_name}
        deleteLabel="Supprimer ce relevé"
        onDelete={canDelete ? () => onDelete(events) : undefined}
      />
      <div className="journal-detail d-flex flex-wrap gap-2 mt-1">
        {catches.filter((event) => (event.quantity ?? 0) > 0 || (event.observed_quantity ?? 0) > 0).map((event) => {
          const photo = event.photos[0];
          const held = event.observed_quantity ?? event.quantity;
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
                  <AuthImage
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
              {held !== event.quantity && (
                <div className="text-truncate text-muted" style={{ fontSize: '0.7rem' }}>
                  {held} présent{(held ?? 0) > 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(actions.length > 0 || first.bycatch_counted === false || accumulates || first.emptied === false) && (
        <div className="journal-detail small text-muted d-flex flex-wrap column-gap-3 mt-1">
          {(accumulates || first.emptied === false) && first.emptied !== null && (
            <span>
              <i className={`bi bi-${first.emptied ? 'arrow-counterclockwise' : 'stack'} me-1`} aria-hidden="true" />
              {first.emptied ? 'Vidé' : 'Laissé en place'}
            </span>
          )}
          {actions.map((action) => {
            const actionInfo = eventKindInfo(action.kind);
            return (
              <span key={action.id}>
                <span className="me-1" aria-hidden="true">{actionInfo.icon}</span>
                {actionInfo.label}
              </span>
            );
          })}
          {first.bycatch_counted === false && <span>Autres insectes non comptés</span>}
        </div>
      )}
      {comments.map((text) => <div key={text} className="journal-detail small mt-1">{text}</div>)}
    </div>
  );
}

/**
 * What a trap that accumulates held at its last reading: what it was left
 * with, or nothing once emptied, and when. Null when unknown (no reading yet,
 * or the journal not loaded): the tile is then left out.
 */
function lastContents(trap: Trap): { count: number; unit: string; note?: string; at: string } | null {
  const { contents } = trap;
  if (contents) {
    const total = contents.items.reduce((sum, item) => sum + item.quantity, 0);
    const plural = total > 1 ? 's' : '';
    return contents.others_counted
      ? { count: total, unit: `insecte${plural}`, at: contents.at }
      : { count: total, unit: `frelon${plural} asiatique${plural}`, note: 'autres non comptés', at: contents.at };
  }
  const lastReading = trap.events?.find((event) => event.kind === 'catch');
  return lastReading ? { count: 0, unit: 'vidé', at: lastReading.performed_at } : null;
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
  const historyAction = useHistoryAction();

  const [sub, setSub] = useState<SubDialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalLength, setJournalLength] = useState(JOURNAL_PAGE);
  const [moreButton, setMoreButton] = useState<HTMLButtonElement | null>(null);

  // The list only carries a summary; the journal comes with the detail
  useEffect(() => {
    if (show && trap && auth.isAuthenticated) {
      dispatch(fetchTrapDetail(trap.id));
    }
  }, [show, trap, auth.isAuthenticated, dispatch]);

  // Prefer the detailed copy once it has arrived
  const current = detailed && detailed.id === trap?.id ? detailed : trap;
  const events = current?.events ?? [];
  const entries = journalEntries(events);
  const showMore = () => setJournalLength((length) => length + JOURNAL_PAGE);
  const hasMore = entries.length > journalLength;

  // The journal grows as its foot comes into view (the dialog body is the only
  // scrolling box); the button stays as the manual way. A new observer fires at
  // once, so a foot still in view after a batch loads the next one.
  useEffect(() => {
    if (!moreButton || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (observed) => { if (observed.some((item) => item.isIntersecting)) setJournalLength((length) => length + JOURNAL_PAGE); },
      { rootMargin: '200px' },
    );
    observer.observe(moreButton);
    return () => observer.disconnect();
  }, [moreButton, hasMore, journalLength]);

  if (!trap || !current) return null;

  const mayEdit = canEditTrap(current);
  const mayAct = canActOnTrap(current);
  const held = current.trap_type.accumulates ? lastContents(current) : null;
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
  const history = historyAction(`trap:${current.id}`, `Piège #${current.id}`);

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

        <div className="trap-kpis mb-2">
          {current.photo_url && (
            <AuthImage
              src={current.photo_url}
              alt="Photo du piège"
              role="button"
              onClick={() => preview(current.photo_url!)}
              className="trap-thumb"
            />
          )}
          {held && (
            <div className="trap-kpi trap-kpi-hot">
              <div className="trap-kpi-value">{held.count}</div>
              <div className="trap-kpi-label">Dans le piège</div>
              <div className="trap-kpi-note">
                {held.unit}
                {held.note && `, ${held.note}`}
                {' · '}
                <span className="text-nowrap">{formatDate(held.at)}</span>
              </div>
            </div>
          )}
          <div className={`trap-kpi${held ? '' : ' trap-kpi-hot'}`}>
            <div className="trap-kpi-value">{current.hornet_catch_count}</div>
            <div className="trap-kpi-label">
              <span className="me-1" aria-hidden="true">🐝</span>
              Frelons capturés
            </div>
          </div>
        </div>

        {auth.isAuthenticated && (mayAct || mayEdit || canAddHere || onLocate || history) && (
          <SheetActions
            className="mb-2"
            more={[
              mayEdit && { icon: ACTION_ICONS.move, label: 'Déplacer', onClick: handleMove },
              mayEdit && { icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => setSub({ kind: 'edit' }) },
              canAddHere && {
                icon: ACTION_ICONS.addHere,
                label: 'Ajouter à cette position',
                onClick: () => onAddAtLocation(current.latitude, current.longitude),
              },
              history,
              mayEdit && { icon: ACTION_ICONS.delete, label: 'Supprimer', tone: 'danger', onClick: () => setSub({ kind: 'delete' }) },
            ]}
          >
            {mayAct && (
              <>
                <Button
                  variant="primary"
                  onClick={() => setSub({ kind: 'event', eventKind: 'catch' })}
                  aria-label="Enregistrer un relevé"
                >
                  <span className="me-2" aria-hidden="true">🐝</span>
                  Relevé
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
                icon={ACTION_ICONS.showOnMap}
                label="Voir sur la carte"
                onClick={() => onLocate(current)}
              />
            )}
          </SheetActions>
        )}

        {auth.isAuthenticated && <TrapDelegationPanel trap={current} />}

        <Accordion className="mt-2">
          <Accordion.Item eventKey="details">
            <Accordion.Header>
              <i className="bi bi-info-circle me-2" aria-hidden="true" />
              Détails
            </Accordion.Header>
            <Accordion.Body>
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
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        {!auth.isAuthenticated && (
          <Alert variant="light" className="small mt-2 mb-0">
            Connectez-vous pour consulter le journal de ce piège.
          </Alert>
        )}

        {auth.isAuthenticated && (
          <section className="trap-journal" aria-label="Journal">
            <div className="trap-journal-head">
              <i className="bi bi-journal-text" aria-hidden="true" />
              <strong className="flex-grow-1">Journal</strong>
              {entries.length > 0 && <Badge bg="secondary" pill>{entries.length}</Badge>}
            </div>
            {events.length === 0 ? (
              <p className="text-muted small m-0 p-3">
                {current.events ? 'Aucune intervention enregistrée.' : <Spinner animation="border" size="sm" />}
              </p>
            ) : (
              <>
                <div className="trap-journal-body">
                  {entries.slice(0, journalLength).map((entry) => (isReading(entry) ? (
                    <VisitRow
                      key={entry[0].id}
                      events={entry}
                      accumulates={Boolean(current.trap_type.accumulates)}
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
                </div>
                {hasMore && (
                  <Button ref={setMoreButton} variant="link" className="w-100 trap-journal-more" onClick={showMore}>
                    Voir plus ({entries.length - journalLength})
                  </Button>
                )}
              </>
            )}
          </section>
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
        itemName={sub?.kind === 'delete-entry' && isReading(sub.entry) ? 'ce relevé' : 'cette intervention'}
      />

      {/* Agrandissement d'une photo */}
      <AppModal
        show={sub?.kind === 'photo'}
        onHide={closeSub}
        title="Photo"
        size="lg"
        bodyClassName="p-0 d-flex align-items-center bg-dark"
      >
        {sub?.kind === 'photo' && <AuthImage src={sub.url} alt="Photo" className="w-100" />}
      </AppModal>
    </>
  );
}
