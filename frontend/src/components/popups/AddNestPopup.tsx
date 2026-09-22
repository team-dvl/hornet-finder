import { useState } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch } from '../../store/hooks';
import { createNest } from '../../store/store';
import CoordinateInput from '../common/CoordinateInput';
import { reverseGeocode } from '../../utils/geocoding';

interface AddNestPopupProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSuccess?: () => void;
}

export default function AddNestPopup({ show, onHide, latitude, longitude, onSuccess }: AddNestPopupProps) {
  const [publicPlace, setPublicPlace] = useState(false);
  const [address, setAddress] = useState('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();
  const dispatch = useAppDispatch();

  // Fonction pour récupérer l'adresse via géocodage inverse (optionnel)
  const fetchAddress = async () => {
    const found = await reverseGeocode(latitude, longitude);
    if (found) {
      setAddress(found);
    }
  };

  // Récupérer l'adresse automatiquement quand la popup s'ouvre
  useState(() => {
    if (show && !address) {
      fetchAddress();
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth.user?.access_token) {
      setError('Vous devez être connecté pour ajouter un nid');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await dispatch(createNest({
        latitude,
        longitude,
        public_place: publicPlace,
        address: address.trim() || undefined,
        comments: comments.trim() || undefined,
        accessToken: auth.user.access_token,
        userGuid: auth.user?.profile?.sub || ''
      })).unwrap();

      // Réinitialiser le formulaire
      setPublicPlace(false);
      setAddress('');
      setComments('');
      
      // Fermer la popup et notifier le succès
      onHide();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setError(error as string);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPublicPlace(false);
      setAddress('');
      setComments('');
      setError(null);
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">🏴</span>
          Ajouter un nid de frelon
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <div className="mb-3">
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
          </div>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="publicPlace"
              label="🏛️ Lieu public"
              checked={publicPlace}
              onChange={(e) => setPublicPlace(e.target.checked)}
            />
            <Form.Text className="text-muted">
              Cochez si le nid se trouve dans un lieu public (parc, rue, etc.)
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Adresse (optionnel)</Form.Label>
            <Form.Control
              type="text"
              placeholder="L'adresse sera récupérée automatiquement si possible"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Form.Text className="text-muted">
              Précisez l'adresse ou laissez vide pour la déduction automatique
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Commentaires (optionnel)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Ajoutez des détails sur le nid : taille, accessibilité, danger, etc."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </Form.Group>

          <div className="border-top pt-3">
            <div className="text-muted small">
              <strong>ℹ️ Informations par défaut :</strong>
              <ul className="mb-0 mt-2">
                <li>Statut : Non détruit (actif)</li>
                <li>Signalé par : {auth.user?.profile?.preferred_username || 'Utilisateur actuel'}</li>
              </ul>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Annuler
          </Button>
          <Button variant="danger" type="submit" disabled={loading}>
            {loading && <Spinner animation="border" size="sm" className="me-2" />}
            🏴 Signaler le nid
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
