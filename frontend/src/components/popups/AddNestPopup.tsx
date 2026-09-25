import { useState } from 'react';
import { Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch } from '../../store/hooks';
import { createNest } from '../../store/store';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
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
    <AppModal
      show={show}
      onHide={handleClose}
      locked
      icon={OBJECT_ICONS.nest}
      title="Nouveau nid"
      onSubmit={handleSubmit}
      footer={(
        <Button variant="danger" type="submit" disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Signaler
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          id="publicPlace"
          label="Lieu public (parc, rue…)"
          checked={publicPlace}
          onChange={(e) => setPublicPlace(e.target.checked)}
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="nest-address">
        <Form.Label>Adresse</Form.Label>
        <Form.Control
          type="text"
          placeholder="Déduite de la position si vide"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-0" controlId="nest-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          placeholder="Taille, accessibilité, danger…"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </Form.Group>
    </AppModal>
  );
}
