import { Modal, Button, ListGroup, Badge, Form, InputGroup, Alert } from 'react-bootstrap';
import { useState, useMemo } from 'react';
import { Hornet, updateHornetDuration, updateHornetColors, deleteHornet } from '../../store/store';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAuth } from 'react-oidc-context';
import { ColorSelector } from '../common';
import { DeleteConfirmationModal } from '../modals';
import { HORNET_RETURN_ZONE_ANGLE_DEG, HORNET_FLIGHT_SPEED_M_PER_MIN, HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M } from '../../utils/constants';
import CoordinateInput from '../common/CoordinateInput';

interface HornetInfoPopupProps {
  show: boolean;
  onHide: () => void;
  hornet: Hornet | null;
  onAddAtLocation?: (lat: number, lng: number) => void; // Nouvelle prop pour déclencher l'ajout
}

export default function HornetInfoPopup({ show, onHide, hornet, onAddAtLocation }: HornetInfoPopupProps) {
  const dispatch = useAppDispatch();
  const { canEditHornet, canDeleteHornet, canAddHornet, canAddApiary, accessToken } = useUserPermissions();
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

  const formatDurationInput = (minutes: number) => {
    return (minutes * 60).toString();
  };

  // Formatter la date si disponible
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non disponible';
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convertir la direction en point cardinal
  const getDirectionLabel = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return `${degrees}° (${directions[index]})`;
  };

  // Calculer la distance estimée du nid basée sur la durée
  const calculateNestDistance = (duration?: number) => {
    if (!duration || duration <= 0) {
      return {
        distance: 2000, // Distance max par défaut: 2km
        isEstimated: false,
        displayText: "2 km (distance maximale par défaut)"
      };
    }
    
    // Calcul basé sur la vitesse du frelon
    const distanceInMeters = Math.round((duration / 60) * HORNET_FLIGHT_SPEED_M_PER_MIN);
    const finalDistance = Math.min(distanceInMeters, HORNET_RETURN_ZONE_ABSOLUTE_MAX_DISTANCE_M);
    
    if (finalDistance < 1000) {
      return {
        distance: finalDistance,
        isEstimated: true,
        displayText: `${finalDistance} m (estimé d'après la durée d'absence)`
      };
    } else {
      return {
        distance: finalDistance,
        isEstimated: true,
        displayText: `${(finalDistance / 1000).toFixed(1)} km (estimé d'après la durée d'absence)`
      };
    }
  };

  const nestInfo = calculateNestDistance(currentHornet.duration);

  // Formater la durée en minutes et secondes
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Non renseignée';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    return remainingSeconds === 0 ? `${minutes}min` : `${minutes}min ${remainingSeconds}s`;
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">🐝</span>
          Informations du frelon
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <ListGroup variant="flush">
          {currentHornet.id && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>ID:</strong>
              <Badge bg="secondary">{currentHornet.id}</Badge>
            </ListGroup.Item>
          )}
          
          <ListGroup.Item>
            <div className="d-flex flex-column gap-3">
              <CoordinateInput
                label="Latitude"
                value={currentHornet.latitude}
                onChange={() => {}} // Ne sera pas appelé en mode lecture seule
                readOnly={true}
                precision={6}
                labelPosition="horizontal"
              />
              <CoordinateInput
                label="Longitude"
                value={currentHornet.longitude}
                onChange={() => {}} // Ne sera pas appelé en mode lecture seule
                readOnly={true}
                precision={6}
                labelPosition="horizontal"
              />
            </div>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Direction de vol:</strong>
            <span>{getDirectionLabel(currentHornet.direction)}</span>
          </ListGroup.Item>
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Durée d'absence:</strong>
            <div className="d-flex align-items-center gap-2">
              {!isEditing ? (
                <>
                  <span className={currentHornet.duration ? "text-info" : "text-muted"}>
                    {formatDuration(currentHornet.duration)}
                  </span>
                  {canEdit && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={handleEditStart}
                      disabled={isUpdating}
                    >
                      {currentHornet.duration ? 'Modifier' : 'Ajouter'}
                    </Button>
                  )}
                </>
              ) : (
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <InputGroup size="sm" style={{ width: '120px' }}>
                      <Form.Control
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        placeholder="Secondes"
                        min="1"
                      />
                      <InputGroup.Text>s</InputGroup.Text>
                    </InputGroup>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={handleEditSave}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Sauvegarde...' : 'Sauver'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleEditCancel}
                      disabled={isUpdating}
                    >
                      Annuler
                    </Button>
                  </div>
                  <div className="d-flex gap-1">
                    <small className="text-muted me-2">Durées courantes:</small>
                    {[1, 2, 5, 10, 15, 30].map(minutes => (
                      <Button
                        key={minutes}
                        variant="outline-info"
                        size="sm"
                        onClick={() => setEditDuration(formatDurationInput(minutes))}
                        disabled={isUpdating}
                      >
                        {minutes}min
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ListGroup.Item>
          
          {updateError && (
            <ListGroup.Item>
              <Alert variant="danger" className="mb-0 py-2">
                {updateError}
              </Alert>
            </ListGroup.Item>
          )}
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Distance estimée du nid:</strong>
            <span className={nestInfo.isEstimated ? "text-success" : "text-muted"}>
              {nestInfo.displayText}
            </span>
          </ListGroup.Item>
          
          <ListGroup.Item>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>Marquage couleur:</strong>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <ColorSelector
                value={currentHornet.mark_color_1 || ''}
                readOnly={!canEdit}
                size="sm"
                onChange={canEdit ? async (color1) => {
                  if (color1 !== currentHornet.mark_color_1 && accessToken && currentHornet.id) {
                    try {
                      await dispatch(updateHornetColors({
                        hornetId: currentHornet.id,
                        markColor1: color1,
                        markColor2: currentHornet.mark_color_2 || '',
                        accessToken
                      })).unwrap();
                    } catch (error) {}
                  }
                } : undefined}
              />
              <ColorSelector
                value={currentHornet.mark_color_2 || ''}
                readOnly={!canEdit}
                size="sm"
                onChange={canEdit ? async (color2) => {
                  if (color2 !== currentHornet.mark_color_2 && accessToken && currentHornet.id) {
                    try {
                      await dispatch(updateHornetColors({
                        hornetId: currentHornet.id,
                        markColor1: currentHornet.mark_color_1 || '',
                        markColor2: color2,
                        accessToken
                      })).unwrap();
                    } catch (error) {}
                  }
                } : undefined}
              />
              {!currentHornet.mark_color_1 && !currentHornet.mark_color_2 && (
                <span className="text-muted">Aucun marquage</span>
              )}
            </div>
          </ListGroup.Item>
          
          {currentHornet.created_at && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Observé le:</strong>
              <span className="text-muted small">
                {formatDate(currentHornet.created_at)}
              </span>
            </ListGroup.Item>
          )}
          
          {currentHornet.updated_at && currentHornet.updated_at !== currentHornet.created_at && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Mis à jour le:</strong>
              <span className="text-muted small">
                {formatDate(currentHornet.updated_at)}
              </span>
            </ListGroup.Item>
          )}
          
          {currentHornet.user_id && (
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <strong>Rapporté par:</strong>
              <Badge bg="info">Utilisateur #{currentHornet.user_id}</Badge>
            </ListGroup.Item>
          )}
          
          <ListGroup.Item>
            <div className="text-muted small">
              <strong>Zone de retour probable:</strong><br/>
              Cette zone triangulaire représente la direction probable du nid du frelon basée sur sa direction de vol observée.
              {nestInfo.isEstimated ? (
                <>
                  {' '}La zone s&apos;étend sur {nestInfo.distance < 1000 ? `${nestInfo.distance} m` : `${(nestInfo.distance / 1000).toFixed(1)} km`} avec un angle de dispersion de {HORNET_RETURN_ZONE_ANGLE_DEG}°, 
                  calculée d&apos;après la durée d&apos;absence observée ({HORNET_FLIGHT_SPEED_M_PER_MIN}m par minute d&apos;absence).
                </>
              ) : (
                <> La zone s&apos;étend sur la distance maximale de 2 km avec un angle de dispersion de {HORNET_RETURN_ZONE_ANGLE_DEG}°.</>
              )}
            </div>
          </ListGroup.Item>
        </ListGroup>
      </Modal.Body>
      
      <Modal.Footer>
        {auth.isAuthenticated && (canAddHornet || canAddApiary) && onAddAtLocation && hornet && (
          <Button 
            variant="outline-primary" 
            onClick={() => onAddAtLocation(hornet.latitude, hornet.longitude)}
            className="me-auto"
          >
            📍 Ajouter à cette position
          </Button>
        )}
        
        {/* Bouton de suppression pour les administrateurs et propriétaires */}
        {auth.isAuthenticated && canDeleteHornet(currentHornet) && (
          <Button 
            variant="outline-danger" 
            onClick={() => setShowDeleteModal(true)}
            className="me-2"
          >
            <i className="fas fa-trash me-1"></i>
            Supprimer
          </Button>
        )}
        
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
      
      {/* Modal de confirmation de suppression */}
      <DeleteConfirmationModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={`frelon #${currentHornet.id}`}
        itemType="frelon"
        isDeleting={isDeleting}
        deleteError={deleteError}
      />
    </Modal>
  );
}
