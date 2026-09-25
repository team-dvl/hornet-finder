import { Button, Form, InputGroup, Alert } from 'react-bootstrap';
import { useState, useMemo } from 'react';
import { Hornet, updateHornetDuration, updateHornetColors, deleteHornet, archiveHornet } from '../../store/store';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAuth } from 'react-oidc-context';
import { ColorSelector, HelpTip } from '../common';
import { AppModal, FieldRow, IconButton } from '../ui';
import { ACTION_ICONS, OBJECT_ICONS } from '../../utils/icons';
import { formatDateTime, formatDistance, formatDuration } from '../../utils/format';
import { ConfirmationModal } from '../modals';
import { HORNET_RETURN_ZONE_ANGLE_DEG, HORNET_FLIGHT_SPEED_M_PER_MIN, HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M } from '../../utils/constants';
import CorrectedDirectionInfo from '../common/CorrectedDirectionInfo';

interface HornetInfoPopupProps {
  show: boolean;
  onHide: () => void;
  hornet: Hornet | null;
  onAddAtLocation?: (lat: number, lng: number) => void;
  declination?: number | null;
  correctedDirection?: number | null;
}

export default function HornetInfoPopup({ show, onHide, hornet, onAddAtLocation, declination, correctedDirection }: HornetInfoPopupProps) {
  const dispatch = useAppDispatch();
  const { canEditHornet, canDeleteHornet, canArchiveHornet, accessToken } = useUserPermissions();
  const auth = useAuth();
  
  // Récupérer les données mises à jour depuis le store Redux
  const hornets = useAppSelector(state => state.hornets.hornets);
  const currentHornet = useMemo(() => {
    if (!hornet?.id) return hornet;
    return hornets.find(h => h.id === hornet.id) || hornet;
  }, [hornets, hornet]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDuration, setEditDuration] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // États pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // États pour l'archivage
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  if (!currentHornet) {
    return null;
  }

  // Logique de suppression
  const handleDelete = async () => {
    if (!currentHornet?.id || !accessToken) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      await dispatch(deleteHornet({ 
        hornetId: currentHornet.id, 
        accessToken 
      })).unwrap();
      
      setShowDeleteModal(false);
      onHide(); // Fermer le popup principal
    } catch (error) {
      setDeleteError(error as string);
    } finally {
      setIsDeleting(false);
    }
  };

  const canEdit = canEditHornet(currentHornet);

  // Logique d'archivage
  const handleArchive = async () => {
    if (!currentHornet?.id || !accessToken) return;

    setIsArchiving(true);
    setArchiveError(null);

    try {
      await dispatch(archiveHornet({
        hornetId: currentHornet.id,
        accessToken
      })).unwrap();

      setShowArchiveModal(false);
      onHide(); // Fermer le popup principal
    } catch (error) {
      setArchiveError(error as string);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleEditStart = () => {
    setIsEditing(true);
    setEditDuration(currentHornet.duration ? currentHornet.duration.toString() : '');
    setUpdateError(null);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditDuration('');
    setUpdateError(null);
  };

  const handleEditSave = async () => {
    if (!currentHornet.id || !accessToken) return;

    const durationValue = parseInt(editDuration);
    if (isNaN(durationValue) || durationValue <= 0) {
      setUpdateError('Veuillez entrer une durée valide en secondes.');
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      await dispatch(updateHornetDuration({
        hornetId: currentHornet.id,
        duration: durationValue,
        accessToken
      })).unwrap();

      setIsEditing(false);
      setEditDuration('');
    } catch (error) {
      setUpdateError(error as string);
    } finally {
      setIsUpdating(false);
    }
  };

  // Distance estimée du nid, d'après la durée d'absence (2 km par défaut)
  const nestDistance = currentHornet.duration && currentHornet.duration > 0
    ? Math.min(Math.round((currentHornet.duration / 60) * HORNET_FLIGHT_SPEED_M_PER_MIN), HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M)
    : null;

  const updateColors = async (markColor1: string, markColor2: string) => {
    if (!accessToken || !currentHornet.id) return;
    try {
      await dispatch(updateHornetColors({ hornetId: currentHornet.id, markColor1, markColor2, accessToken })).unwrap();
    } catch {
      // The sheet keeps showing the stored colours
    }
  };

  const confirming = showDeleteModal || showArchiveModal;
  const canDelete = auth.isAuthenticated && canDeleteHornet(currentHornet);
  const canArchive = auth.isAuthenticated && canArchiveHornet() && !currentHornet.archived;

  return (
    <>
      <AppModal
        show={show && !confirming}
        onHide={onHide}
        icon={OBJECT_ICONS.hornet}
        title={`Frelon #${currentHornet.id}`}
      >
        <FieldRow label="Direction de vol">
          {typeof currentHornet.direction === 'number' ? (
            <CorrectedDirectionInfo
              correctedDirection={correctedDirection ?? currentHornet.direction}
              declination={declination ?? 0}
              popoverId={`popover-hornetinfo-${currentHornet.id}`}
            />
          ) : '—'}
        </FieldRow>

        <FieldRow label="Durée d'absence">
          {!isEditing ? (
            <span className="d-inline-flex align-items-center gap-1">
              {formatDuration(currentHornet.duration) || '—'}
              {canEdit && (
                <Button
                  variant="link"
                  className="p-0 ms-1"
                  onClick={handleEditStart}
                  disabled={isUpdating}
                  aria-label="Modifier la durée"
                  title="Modifier la durée"
                >
                  <i className={`bi bi-${ACTION_ICONS.edit}`} aria-hidden="true" />
                </Button>
              )}
            </span>
          ) : null}
        </FieldRow>
        {isEditing && (
          <div className="mb-2">
            <div className="d-flex flex-wrap gap-2 mb-2">
              {[1, 2, 5, 10, 15, 30].map((minutes) => (
                <Button
                  key={minutes}
                  variant={editDuration === String(minutes * 60) ? 'info' : 'outline-info'}
                  className="rounded-pill"
                  onClick={() => setEditDuration(String(minutes * 60))}
                  disabled={isUpdating}
                >
                  {minutes} min
                </Button>
              ))}
            </div>
            <div className="d-flex gap-2">
              <InputGroup>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="Durée"
                  min="1"
                />
                <InputGroup.Text>s</InputGroup.Text>
              </InputGroup>
              <IconButton variant="outline-secondary" icon="x-lg" label="Annuler" showLabel="never" onClick={handleEditCancel} disabled={isUpdating} />
              <IconButton variant="success" icon={ACTION_ICONS.save} label="Enregistrer" showLabel="never" onClick={handleEditSave} disabled={isUpdating} />
            </div>
          </div>
        )}
        {updateError && <Alert variant="danger" className="py-2">{updateError}</Alert>}

        <FieldRow label={(
          <span className="d-inline-flex align-items-center">
            Distance estimée du nid
            <HelpTip id={`hornet-${currentHornet.id}-zone-help`} title="Zone de retour probable">
              Le triangle sur la carte montre où chercher le nid, dans la direction de vol, avec un angle de
              {' '}{HORNET_RETURN_ZONE_ANGLE_DEG}°. Sa longueur vient de la durée d'absence
              ({HORNET_FLIGHT_SPEED_M_PER_MIN} m par minute), 2 km au plus quand elle est inconnue.
            </HelpTip>
          </span>
        )}>
          {nestDistance !== null ? formatDistance(nestDistance) : <span className="text-muted">2 km au plus</span>}
        </FieldRow>

        {currentHornet.created_at && <FieldRow label="Observé le">{formatDateTime(currentHornet.created_at)}</FieldRow>}
        {currentHornet.created_by?.display_name && <FieldRow label="Signalé par">{currentHornet.created_by.display_name}</FieldRow>}

        <div className="mt-2">
          <div className="text-muted small mb-1">Marquage</div>
          {canEdit ? (
            <div className="d-flex flex-column gap-2">
              <ColorSelector
                value={currentHornet.mark_color_1 || ''}
                onChange={(color) => color !== currentHornet.mark_color_1 && updateColors(color, currentHornet.mark_color_2 || '')}
              />
              <ColorSelector
                value={currentHornet.mark_color_2 || ''}
                onChange={(color) => color !== currentHornet.mark_color_2 && updateColors(currentHornet.mark_color_1 || '', color)}
              />
            </div>
          ) : (
            <div className="d-flex gap-2">
              <ColorSelector value={currentHornet.mark_color_1 || ''} readOnly />
              <ColorSelector value={currentHornet.mark_color_2 || ''} readOnly />
              {!currentHornet.mark_color_1 && !currentHornet.mark_color_2 && <span>—</span>}
            </div>
          )}
        </div>

        {(canDelete || canArchive || (auth.isAuthenticated && onAddAtLocation)) && (
          <div className="sheet-actions mt-3">
            {auth.isAuthenticated && onAddAtLocation && (
              <IconButton
                variant="outline-secondary"
                icon={ACTION_ICONS.addHere}
                label="Ajouter à cette position"
                onClick={() => onAddAtLocation(currentHornet.latitude, currentHornet.longitude)}
              />
            )}
            {canArchive && (
              <IconButton variant="outline-warning" icon={ACTION_ICONS.archive} label="Archiver" className="ms-auto" onClick={() => setShowArchiveModal(true)} />
            )}
            {canDelete && (
              <IconButton
                variant="outline-danger"
                icon={ACTION_ICONS.delete}
                label="Supprimer"
                className={canArchive ? '' : 'ms-auto'}
                onClick={() => setShowDeleteModal(true)}
              />
            )}
          </div>
        )}
      </AppModal>

      <ConfirmationModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`le frelon #${currentHornet.id}`}
        action="delete"
        isDeleting={isDeleting}
        deleteError={deleteError}
      />

      <ConfirmationModal
        show={showArchiveModal}
        onHide={() => setShowArchiveModal(false)}
        onConfirm={handleArchive}
        itemName={`le frelon #${currentHornet.id}`}
        action="archive"
        isDeleting={isArchiving}
        deleteError={archiveError}
      />
    </>
  );
}
