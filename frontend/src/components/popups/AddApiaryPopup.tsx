import { Modal, Button, Form, Alert, Row, Col } from 'react-bootstrap';
import { useState } from 'react';
import { createApiary } from '../../store/store';
import { useAppDispatch } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import CoordinateInput from '../common/CoordinateInput';

interface AddApiaryPopupProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSuccess?: () => void;
}

const INFESTATION_LEVELS = [
  { value: 1 as const, label: 'Faible', description: 'Présence faible de frelons asiatiques', color: 'warning' },
  { value: 2 as const, label: 'Modérée', description: 'Présence modérée de frelons asiatiques', color: 'info' },
  { value: 3 as const, label: 'Élevée', description: 'Forte pression de frelons asiatiques', color: 'danger' }
];

export default function AddApiaryPopup({ show, onHide, latitude, longitude, onSuccess }: AddApiaryPopupProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useUserPermissions();
  
  // États du formulaire
  const [infestationLevel, setInfestationLevel] = useState<1 | 2 | 3>(1);
  const [comments, setComments] = useState('');
  
  // États de contrôle
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const resetForm = () => {
    setInfestationLevel(1);
    setComments('');
    setError(null);
    setValidated(false);
  };

  const handleClose = () => {
    resetForm();
    onHide();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const form = event.currentTarget;
    setValidated(true);

    // Validation des champs obligatoires
    if (!form.checkValidity()) {
      return;
    }

    if (!accessToken) {
      setError('Vous devez être connecté pour ajouter un rucher.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await dispatch(createApiary({
        latitude,
        longitude,
        infestation_level: infestationLevel,
        comments: comments.trim() || undefined,
        accessToken
      })).unwrap();

      // Succès : fermer la popup et réinitialiser le formulaire
      resetForm();
      onHide();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setError(error as string);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedLevel = INFESTATION_LEVELS.find(level => level.value === infestationLevel) || INFESTATION_LEVELS[0];

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">🏠</span>
          Ajouter un nouveau rucher
        </Modal.Title>
      </Modal.Header>
      
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <Row className="mb-3">
            <Col>
              <div className="d-flex flex-column gap-3">
                <CoordinateInput
                  label="Latitude"
                  value={latitude}
                  onChange={() => {}} // Ne sera pas appelé en mode lecture seule
                  readOnly={true}
                  precision={6}
                />
                <CoordinateInput
                  label="Longitude"
                  value={longitude}
                  onChange={() => {}} // Ne sera pas appelé en mode lecture seule
                  readOnly={true}
                  precision={6}
                />
              </div>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Form.Group>
                <Form.Label><strong>Niveau d'infestation *</strong></Form.Label>
                <div className="mt-2">
                  {INFESTATION_LEVELS.map(level => (
                    <Form.Check
                      key={level.value}
                      type="radio"
                      id={`infestation-${level.value}`}
                      name="infestationLevel"
                      label={
                        <div className="d-flex align-items-center">
                          <span className={`badge bg-${level.color} me-2`}>
                            {level.label}
                          </span>
                          <span>{level.description}</span>
                        </div>
                      }
                      checked={infestationLevel === level.value}
                      onChange={() => setInfestationLevel(level.value)}
                      disabled={isSubmitting}
                      className="mb-2"
                    />
                  ))}
                </div>
                <Form.Text className="text-muted">
                  Sélectionnez le niveau d'infestation de frelons asiatiques observé dans ce rucher
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Form.Group>
                <Form.Label><strong>Commentaires (facultatif)</strong></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Observations supplémentaires, mesures prises, etc."
                  disabled={isSubmitting}
                />
                <Form.Text className="text-muted">
                  Ajoutez des informations complémentaires si nécessaire
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Alert variant="info" className="small">
            <strong>Information :</strong> Ce rucher sera enregistré à votre nom. 
            Le niveau d'infestation sélectionné est <strong>{selectedLevel.label.toLowerCase()}</strong>.
          </Alert>
        </Modal.Body>
        
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button 
            type="submit" 
            variant="success"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer le rucher'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
