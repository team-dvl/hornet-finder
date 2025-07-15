import { Modal, Button, ListGroup, Badge, Form, InputGroup, Alert, Dropdown } from 'react-bootstrap';
import { useState, useMemo } from 'react';
import { Hornet, updateHornetDuration, updateHornetColors } from '../../store/store';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAuth } from 'react-oidc-context';
import { COLOR_OPTIONS, getColorLabel, getColorHex } from '../../utils/colors';

interface HornetInfoPopupProps {
  show: boolean;
  onHide: () => void;
  hornet: Hornet | null;
  onAddAtLocation?: (lat: number, lng: number) => void; // Nouvelle prop pour déclencher l'ajout
}

// Composant pour un dropdown de couleur personnalisé
interface ColorDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}

function ColorDropdown({ value, onChange, disabled, label }: ColorDropdownProps) {
  const selectedOption = COLOR_OPTIONS.find(option => option.value === value) || COLOR_OPTIONS[0];
  
  return (
    <div>
      <Form.Label className="small mb-1">{label}:</Form.Label>
      <Dropdown>
        <Dropdown.Toggle
          variant="outline-secondary"
          size="sm"
          disabled={disabled}
          className="d-flex align-items-center gap-2 w-100"
          style={{ minWidth: '140px' }}
        >
          <div 
            style={{
              width: '16px',
              height: '16px',
              backgroundColor: getColorHex(selectedOption.value),
              border: selectedOption.value === 'white' || selectedOption.value === '' ? '1px solid #ccc' : 'none',
              borderRadius: '3px'
            }}
          ></div>
          <span>{selectedOption.label}</span>
        </Dropdown.Toggle>

        <Dropdown.Menu style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {COLOR_OPTIONS.map(color => (
            <Dropdown.Item
              key={color.value}
              onClick={() => onChange(color.value)}
              className="d-flex align-items-center gap-2"
            >
              <div 
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: getColorHex(color.value),
                  border: color.value === 'white' || color.value === '' ? '1px solid #ccc' : 'none',
                  borderRadius: '3px'
                }}
              ></div>
              <span>{color.label}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

export default function HornetInfoPopup({ show, onHide, hornet, onAddAtLocation }: HornetInfoPopupProps) {
  const dispatch = useAppDispatch();
  const { canEditHornet, canAddHornet, canAddApiary, accessToken } = useUserPermissions();
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
  
  // États pour l'édition des couleurs
  const [isEditingColors, setIsEditingColors] = useState(false);
  const [editColor1, setEditColor1] = useState('');
  const [editColor2, setEditColor2] = useState('');
  const [colorUpdateError, setColorUpdateError] = useState<string | null>(null);
  const [isUpdatingColors, setIsUpdatingColors] = useState(false);

  if (!currentHornet) {
    return null;
  }

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

  // Fonctions pour gérer l'édition des couleurs
  const handleColorsEditStart = () => {
    setIsEditingColors(true);
    setEditColor1(currentHornet.mark_color_1 || '');
    setEditColor2(currentHornet.mark_color_2 || '');
    setColorUpdateError(null);
  };

  const handleColorsEditCancel = () => {
    setIsEditingColors(false);
    setEditColor1('');
    setEditColor2('');
    setColorUpdateError(null);
  };

  const handleColorsEditSave = async () => {
    if (!currentHornet.id || !accessToken) return;

    // Validation : les deux couleurs ne peuvent pas être identiques si elles existent
    if (editColor1 && editColor2 && editColor1 === editColor2) {
      setColorUpdateError('Les deux marques de couleur ne peuvent pas être identiques.');
      return;
    }

    setIsUpdatingColors(true);
    setColorUpdateError(null);

    try {
      await dispatch(updateHornetColors({
        hornetId: currentHornet.id,
        markColor1: editColor1,
        markColor2: editColor2,
        accessToken
      })).unwrap();

      setIsEditingColors(false);
      setEditColor1('');
      setEditColor2('');
    } catch (error) {
      setColorUpdateError(error as string);
    } finally {
      setIsUpdatingColors(false);
    }
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
    
    // 100m par minute = 100m / 60s = 1.67m par seconde
    const distanceInMeters = Math.round((duration / 60) * 100);
    const maxDistance = 3000; // 3km max
    const finalDistance = Math.min(distanceInMeters, maxDistance);
    
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
          
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <strong>Position:</strong>
            <span className="text-end">
              <div>Lat: {currentHornet.latitude.toFixed(6)}</div>
              <div>Lng: {currentHornet.longitude.toFixed(6)}</div>
            </span>
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
              {canEdit && !isEditingColors && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleColorsEditStart}
                  disabled={isUpdatingColors}
                >
                  {(currentHornet.mark_color_1 || currentHornet.mark_color_2) ? 'Modifier' : 'Ajouter'}
                </Button>
              )}
            </div>
            
            {!isEditingColors ? (
              <div className="d-flex gap-2 align-items-center">
                {currentHornet.mark_color_1 ? (
                  <div className="d-flex align-items-center gap-1">
                    <div 
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: getColorHex(currentHornet.mark_color_1),
                        border: currentHornet.mark_color_1 === 'white' ? '1px solid #ccc' : 'none',
                        borderRadius: '3px'
                      }}
                    ></div>
                    <span className="small">{getColorLabel(currentHornet.mark_color_1)}</span>
                  </div>
                ) : null}
                
                {currentHornet.mark_color_2 ? (
                  <div className="d-flex align-items-center gap-1">
                    <div 
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: getColorHex(currentHornet.mark_color_2),
                        border: currentHornet.mark_color_2 === 'white' ? '1px solid #ccc' : 'none',
                        borderRadius: '3px'
                      }}
                    ></div>
                    <span className="small">{getColorLabel(currentHornet.mark_color_2)}</span>
                  </div>
                ) : null}
                
                {!currentHornet.mark_color_1 && !currentHornet.mark_color_2 && (
                  <span className="text-muted">Aucun marquage</span>
                )}
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                <div className="d-flex gap-2">
                  <ColorDropdown
                    value={editColor1}
                    onChange={setEditColor1}
                    disabled={isUpdatingColors}
                    label="Couleur 1"
                  />
                  
                  <ColorDropdown
                    value={editColor2}
                    onChange={setEditColor2}
                    disabled={isUpdatingColors}
                    label="Couleur 2"
                  />
                </div>
                
                <div className="d-flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleColorsEditSave}
                    disabled={isUpdatingColors}
                  >
                    {isUpdatingColors ? 'Sauvegarde...' : 'Sauver'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleColorsEditCancel}
                    disabled={isUpdatingColors}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </ListGroup.Item>
          
          {colorUpdateError && (
            <ListGroup.Item>
              <Alert variant="danger" className="mb-0 py-2">
                {colorUpdateError}
              </Alert>
            </ListGroup.Item>
          )}
          
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
                  {' '}La zone s&apos;étend sur {nestInfo.distance < 1000 ? `${nestInfo.distance} m` : `${(nestInfo.distance / 1000).toFixed(1)} km`} avec un angle de dispersion de 5°, 
                  calculée d&apos;après la durée d&apos;absence observée (100m par minute d&apos;absence).
                </>
              ) : (
                <> La zone s&apos;étend sur la distance maximale de 2 km avec un angle de dispersion de 5°.</>
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
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
