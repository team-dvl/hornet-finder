import { useEffect, useState } from 'react';
import { Alert, Badge, Spinner } from 'react-bootstrap';
import { AuthImage } from '../common';
import { ConfirmationModal } from '../modals';
import { AppModal, FieldRow, IconButton, SheetActions } from '../ui';
import { useHistoryAction } from '../../hooks/useHistoryAction';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDateTime } from '../../utils/format';
import { hiveErrorOf } from '../../utils/hivesApi';
import {
  KIND_LABELS, deleteVisit, deleteVisitPhoto, fetchVisit, inspectionSummary, visitLabel,
  type Visit, type VisitPhoto,
} from '../../utils/visitsApi';
import VisitFormModal from './VisitFormModal';
import VisitPhotosModal from './VisitPhotosModal';

interface VisitSheetProps {
  visitId: string;
  onHide: () => void;
  /** After a change; `null` once deleted */
  onChanged: (visit: Visit | null) => void;
}

type SubDialog = 'edit' | 'photos' | 'delete' | { photo: VisitPhoto };

/** Sheet of a visit: when, who, what was done, what was seen of each colony, the photos. */
export default function VisitSheet({ visitId, onHide, onChanged }: VisitSheetProps) {
  const historyAction = useHistoryAction();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [sub, setSub] = useState<SubDialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVisit(visitId)
      .then((found) => { if (!cancelled) setVisit(found); })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [visitId]);

  const changed = (next: Visit) => {
    setVisit(next);
    setSub(null);
    onChanged(next);
  };

  const handleDelete = async () => {
    if (!visit) return;
    setBusy(true);
    setError(null);
    try {
      await deleteVisit(visit.id);
      onChanged(null);
      onHide();
    } catch (deleteError) {
      setError(hiveErrorOf(deleteError));
      setBusy(false);
    }
  };

  const removePhoto = async (photo: VisitPhoto) => {
    if (!visit) return;
    setBusy(true);
    try {
      changed(await deleteVisitPhoto(visit.id, photo.id));
    } catch (removeError) {
      setError(hiveErrorOf(removeError));
      setSub(null);
    } finally {
      setBusy(false);
    }
  };

  const canEdit = Boolean(visit?.permissions?.edit);
  const history = visit && historyAction(`apiary_visit:${visit.id}`, `Visite du ${formatDateTime(visit.started_at)}`);
  const where = visit?.apiary ? (visit.apiary.address || `Rucher #${visit.apiary.id}`) : visit?.apiary_label;
  const people = visit ? [...visit.participants.map((person) => person.display_name), visit.guest_names].filter(Boolean) : [];

  return (
    <>
      <AppModal
        show={sub === null}
        onHide={onHide}
        icon={<i className="bi bi-journal-text hive-icon" aria-hidden="true" />}
        title={visit ? visitLabel(visit) : 'Visite'}
      >
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        {!visit && !error && <Spinner animation="border" size="sm" />}

        {visit && (
          <>
            <FieldRow label="Le">{formatDateTime(visit.started_at)}</FieldRow>
            {visit.duration_minutes && <FieldRow label="Durée">{visit.duration_minutes} min</FieldRow>}
            {where && <FieldRow label="Rucher">{where}</FieldRow>}
            {people.length > 0 && <FieldRow label="Participants">{people.join(', ')}</FieldRow>}
            {visit.kinds.length > 0 && (
              <div className="d-flex flex-wrap gap-1 my-2">
                {visit.kinds.map((kind) => <Badge key={kind} bg="secondary">{KIND_LABELS[kind]}</Badge>)}
              </div>
            )}
            {visit.report && <p className="small mt-2 mb-0 text-break visit-report">{visit.report}</p>}

            {(canEdit || history) && (
              <SheetActions
                className="mt-3"
                more={[
                  canEdit && { icon: ACTION_ICONS.edit, label: 'Modifier', onClick: () => setSub('edit') },
                  history,
                  canEdit && { icon: ACTION_ICONS.delete, label: 'Supprimer', tone: 'danger', onClick: () => setSub('delete') },
                ]}
              >
                {canEdit && (
                  <IconButton variant="outline-primary" icon="camera" label="Photos" onClick={() => setSub('photos')} />
                )}
              </SheetActions>
            )}

            {visit.inspections.length > 0 && (
              <section className="mt-3" aria-label="Colonies">
                <div className="text-muted small mb-1">Colonies</div>
                <div className="list-group">
                  {visit.inspections.map((inspection) => {
                    const summary = inspectionSummary(inspection);
                    return (
                      <div key={inspection.id} className="list-group-item py-2 px-2">
                        <strong className="d-block text-truncate">{inspection.colony_label || inspection.hive_label}</strong>
                        {inspection.colony_label && <span className="d-block small text-muted text-truncate">{inspection.hive_label}</span>}
                        {summary.length > 0 && <span className="d-block small">{summary.join(' · ')}</span>}
                        {inspection.notes && <span className="d-block small text-break mt-1">{inspection.notes}</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {visit.photos.length > 0 && (
              <section className="mt-3" aria-label="Photos">
                <div className="text-muted small mb-1">Photos</div>
                <div className="visit-photos">
                  {visit.photos.map((photo) => (
                    <button key={photo.id} type="button" className="btn p-0 border-0" aria-label="Agrandir la photo"
                      onClick={() => setSub({ photo })}>
                      <AuthImage src={photo.thumbnail_url ?? photo.image_url} alt="Photo de la visite" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </AppModal>

      {visit && sub === 'edit' && <VisitFormModal visit={visit} onHide={() => setSub(null)} onSaved={changed} />}
      {visit && sub === 'photos' && <VisitPhotosModal visit={visit} onHide={() => setSub(null)} onDone={changed} />}
      <ConfirmationModal
        show={sub === 'delete'}
        onHide={() => { setSub(null); setError(null); }}
        onConfirm={handleDelete}
        itemName={visit ? `la visite du ${formatDateTime(visit.started_at)}` : ''}
        isDeleting={busy}
        deleteError={error}
      />
      <AppModal
        show={typeof sub === 'object' && sub !== null}
        onHide={() => setSub(null)}
        title="Photo"
        size="lg"
        bodyClassName="p-0 d-flex flex-column align-items-center bg-dark"
        footer={canEdit && typeof sub === 'object' && sub !== null ? (
          <IconButton variant="outline-danger" icon={ACTION_ICONS.delete} label="Retirer la photo" showLabel="always"
            disabled={busy} onClick={() => void removePhoto(sub.photo)} />
        ) : undefined}
      >
        {typeof sub === 'object' && sub !== null && (
          <AuthImage src={sub.photo.image_url} alt="Photo de la visite" className="w-100" />
        )}
      </AppModal>
    </>
  );
}
