import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { useState } from 'rea          🍯 Informations du Rucher #{currentApiary.id}t';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from 'react-oidc-context';
import { Apiary, updateApiary, selectApiaryById } from './store/slices/apiariesSlice';
import { useUserPermissions } from './hooks/useUserPermissions';
import { AppDispatch, RootState } from './store/store';

// Couleurs selon le niveau d'infestation
const getInfestationColor = (level: 1 | 2 | 3): string => {
  switch (level) {
    case 1: return '#ffc107'; // Jaune - Infestation faible (Light)
    case 2: return '#fd7e14'; // Orange - Infestation modérée (Medium)
    case 3: return '#dc3545'; // Rouge - Infestation élevée (High)
    default: return '#6c757d'; // Gris - Inconnu
  }
};

const getInfestationText = (level: 1 | 2 | 3): string => {
  switch (level) {
    case 1: return 'Infestation faible';
    case 2: return 'Infestation modérée';
    case 3: return 'Infestation élevée';
    default: return 'Niveau inconnu';
  }
};

interface ApiaryInfoPopupProps {
  show: boolean;
  onHide: () => void;
  apiary: Apiary | null;
}

export default function ApiaryInfoPopup({ show, onHide, apiary }: ApiaryInfoPopupProps) {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useAuth();
  const { canAddApiary } = useUserPermissions(); // Les apiculteurs peuvent modifier leurs ruchers
  const [isEditing, setIsEditing] = useState(false);
  const [editInfestationLevel, setEditInfestationLevel] = useState<1 | 2 | 3>(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Récupérer le rucher mis à jour depuis Redux si on a un ID, sinon utiliser la prop
  const updatedApiary = useSelector((state: RootState) => 
    selectApiaryById(state, apiary?.id)
  );
  
  // Utiliser le rucher mis à jour depuis Redux, ou la prop en fallback
  const currentApiary = updatedApiary || apiary;

  if (!currentApiary) return null;

  // Vérifier si l'utilisateur peut éditer ce rucher (apiculteur qui l'a créé ou admin)
  const canEdit = canAddApiary && auth.user?.profile?.email === currentApiary.created_by;

  const handleEditStart = () => {
    setEditInfestationLevel(currentApiary.infestation_level);
    setIsEditing(true);
    setUpdateError(null);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setUpdateError(null);
  };

  const handleEditSave = async () => {
    if (!auth.user?.access_token || !currentApiary.id) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      await dispatch(updateApiary({
        id: currentApiary.id,
        infestation_level: editInfestationLevel,
        accessToken: auth.user.access_token
      })).unwrap();
      
      setIsEditing(false);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          � Informations du Rucher #{apiary.id}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="container-fluid">
          <div className="row mb-3">
            <div className="col-md-6">
              <h6 className="fw-bold">Localisation</h6>
              <div className="mb-2">
                <strong>Latitude :</strong> {apiary.latitude.toFixed(6)}
              </div>
              <div className="mb-2">
                <strong>Longitude :</strong> {apiary.longitude.toFixed(6)}
              </div>
            </div>
            
            <div className="col-md-6">
              <h6 className="fw-bold">État sanitaire</h6>
              <div className="mb-2">
                <div className="d-flex justify-content-between align-items-center">
                  <strong>Niveau d'infestation :</strong>
                  {canEdit && !isEditing && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={handleEditStart}
                    >
                      ✏️ Modifier
                    </Button>
                  )}
                </div>
                
                {!isEditing ? (
                  <div className="mt-1">
                    <span 
                      className="badge px-3 py-2"
                      style={{ 
                        backgroundColor: getInfestationColor(apiary.infestation_level),
                        color: 'white',
                        fontSize: '0.9rem'
                      }}
                    >
                      {getInfestationText(apiary.infestation_level)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Form.Select
                      value={editInfestationLevel}
                      onChange={(e) => setEditInfestationLevel(Number(e.target.value) as 1 | 2 | 3)}
                      disabled={isUpdating}
                      className="mb-2"
                    >
                      <option value={1}>Infestation faible</option>
                      <option value={2}>Infestation modérée</option>
                      <option value={3}>Infestation élevée</option>
                    </Form.Select>
                    <div className="d-flex gap-2">
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
                  </div>
                )}
                
                {updateError && (
                  <Alert variant="danger" className="mt-2 mb-0 py-2">
                    {updateError}
                  </Alert>
                )}
              </div>
            </div>
          </div>
          
          {apiary.comments && (
            <div className="row mb-3">
              <div className="col-12">
                <h6 className="fw-bold">Commentaires</h6>
                <div className="border rounded p-3 bg-light">
                  {apiary.comments}
                </div>
              </div>
            </div>
          )}
          
          <div className="row">
            <div className="col-md-6">
              {apiary.created_at && (
                <div className="mb-2">
                  <strong>Date de création :</strong>
                  <div className="text-muted">
                    {new Date(apiary.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="col-md-6">
              {apiary.created_by && (
                <div className="mb-2">
                  <strong>Créé par :</strong>
                  <div className="text-muted">{apiary.created_by}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
