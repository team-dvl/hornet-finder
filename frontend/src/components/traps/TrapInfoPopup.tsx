import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  deleteTrap, deleteTrapEvent, fetchTrapDetail, selectSelectedTrap, startMovingTrap,
  type Trap, type TrapEvent, type TrapEventKind,
} from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ConfirmationModal } from '../modals';
import TrapDelegationPanel from './TrapDelegationPanel';
import TrapEventModal from './TrapEventModal';
import { eventKindInfo } from './eventKinds';
import TrapFormModal from './TrapFormModal';

interface TrapInfoPopupProps {
  show: boolean;
  onHide: () => void;
  trap: Trap | null;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('fr-BE', { dateStyle: 'medium', timeStyle: 'short' });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('fr-BE', { dateStyle: 'medium' });

/** One entry of the trap journal. */
function EventRow({ event, canDelete, onDelete, onPreview }: {
  event: TrapEvent;
  canDelete: boolean;
  onDelete: (event: TrapEvent) => void;
  onPreview: (url: string) => void;
}) {
  const info = eventKindInfo(event.kind as TrapEventKind);
  return (
    <div className="d-flex gap-2 py-2 border-bottom">
      <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>{info.icon}</div>
      <div className="flex-grow-1">
        <div className="d-flex justify-content-between align-items-start">
          <strong className="small">
            {info.label}
            {event.species && event.quantity ? ` — ${event.quantity} × ${event.species.name}` : ''}
          </strong>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            {formatDateTime(event.performed_at)}
          </span>
        </div>
        {event.performed_by && (
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            par {event.performed_by.display_name}
          </div>
        )}
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
                style={{ height: 56, width: 56, objectFit: 'cover', borderRadius: 4 }}
              />
            ))}
          </div>
        )}
      </div>
      {canDelete && (
        <Button
          variant="link"
          size="sm"
          className="text-danger p-0 align-self-start"
          title="Supprimer cette intervention"
          onClick={() => onDelete(event)}
        >
          <i className="bi bi-trash" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/** Detail of a trap: identity, journal and the actions the user is allowed to take. */
export default function TrapInfoPopup({ show, onHide, trap }: TrapInfoPopupProps) {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const detailed = useAppSelector(selectSelectedTrap);
  const { canEditTrap, canActOnTrap, isAdmin, userGuid } = useUserPermissions();

  const [eventKind, setEventKind] = useState<TrapEventKind | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<TrapEvent | null>(null);

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
  const mayEdit = canEditTrap(current);
  const mayAct = canActOnTrap(current);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await dispatch(deleteTrap(current.id)).unwrap();
      setShowDelete(false);
      onHide();
    } catch (deleteError) {
      setError(deleteError as string);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteEvent = async (event: TrapEvent) => {
    setError(null);
    try {
      await dispatch(deleteTrapEvent({ trapId: current.id, eventId: event.id })).unwrap();
    } catch (deleteError) {
      setError(deleteError as string);
    } finally {
      setEventToDelete(null);
    }
  };

  const canDeleteEvent = (event: TrapEvent) =>
    isAdmin
    || (current.owner?.guid === userGuid)
    || (Boolean(event.performed_by) && event.performed_by?.guid === userGuid);

  const handleMove = () => {
    dispatch(startMovingTrap(current.id));
    onHide();
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="h5">
            <span className="me-2">🪤</span>
            {current.trap_type.name}
            <Badge bg={current.active ? 'success' : 'secondary'} className="ms-2">
              {current.active ? 'En service' : 'Remisé'}
            </Badge>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {current.photo_url && (
            <img
              src={current.photo_url}
              alt="Photo du piège"
              role="button"
              onClick={() => setPreview(current.photo_url!)}
              className="w-100 mb-3 rounded"
              style={{ maxHeight: 200, objectFit: 'cover' }}
            />
          )}

          <div className="mb-3">
            <div className="d-flex justify-content-between">
              <span className="text-muted small">Frelons asiatiques capturés</span>
              <strong>{current.hornet_catch_count}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted small">Installé le</span>
              <span className="small">{formatDate(current.installed_at)}</span>
            </div>
            {current.owner && (
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Propriétaire</span>
                <span className="small">{current.owner.display_name}</span>
              </div>
            )}
            {current.address && (
              <div className="text-muted small mt-2">
                <i className="bi bi-geo-alt me-1" aria-hidden="true" />
                {current.address}
              </div>
            )}
            {current.comments && <p className="small mt-2 mb-0">{current.comments}</p>}
          </div>

          {!auth.isAuthenticated && (
            <Alert variant="light" className="small">
              Connectez-vous pour consulter le journal de ce piège.
            </Alert>
          )}

          {auth.isAuthenticated && (
            <>
              <div className="d-flex gap-2 mb-3 flex-wrap">
                {mayAct && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => setEventKind('catch')}>
                      🐝 Enregistrer une prise
                    </Button>
                    <Button size="sm" variant="outline-primary" onClick={() => setEventKind('inspection')}>
                      📋 Ajouter une action
                    </Button>
                  </>
                )}
                {mayEdit && (
                  <>
                    <Button size="sm" variant="outline-secondary" onClick={handleMove}>
                      ✋ Déplacer
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setShowEdit(true)}>
                      ✏️ Modifier
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => setShowDelete(true)}>
                      🗑️ Supprimer
                    </Button>
                  </>
                )}
              </div>

              <h6>Journal</h6>
              {events.length === 0 ? (
                <p className="text-muted small">
                  {current.events ? 'Aucune intervention enregistrée.' : <Spinner animation="border" size="sm" />}
                </p>
              ) : (
                <div>
                  {events.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      canDelete={canDeleteEvent(event)}
                      onDelete={setEventToDelete}
                      onPreview={setPreview}
                    />
                  ))}
                </div>
              )}

              <TrapDelegationPanel trap={current} />
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Fermer</Button>
        </Modal.Footer>
      </Modal>

      {eventKind !== null && (
        <TrapEventModal
          onHide={() => setEventKind(null)}
          trap={current}
          initialKind={eventKind}
        />
      )}

      {showEdit && (
        <TrapFormModal
          onHide={() => setShowEdit(false)}
          trap={current}
        />
      )}

      <ConfirmationModal
        show={showDelete}
        onHide={() => setShowDelete(false)}
        onConfirm={handleDelete}
        itemName={`Piège #${current.id}`}
        itemType="piège"
        isDeleting={deleting}
        deleteError={error}
      />

      <ConfirmationModal
        show={eventToDelete !== null}
        onHide={() => setEventToDelete(null)}
        onConfirm={() => eventToDelete && handleDeleteEvent(eventToDelete)}
        itemName={eventToDelete ? eventKindInfo(eventToDelete.kind).label : ''}
        itemType="intervention"
      />

      {/* Agrandissement d'une photo */}
      <Modal show={preview !== null} onHide={() => setPreview(null)} centered size="lg">
        <Modal.Body className="p-0">
          {preview && <img src={preview} alt="Photo" className="w-100" />}
        </Modal.Body>
      </Modal>
    </>
  );
}
