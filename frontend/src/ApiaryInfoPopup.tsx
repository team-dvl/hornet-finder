import { Modal, Button } from 'react-bootstrap';
import { Apiary } from './store/slices/apiariesSlice';

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
  if (!apiary) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          🐝 Informations du Rucher #{apiary.id}
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
                <strong>Niveau d'infestation :</strong>
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
