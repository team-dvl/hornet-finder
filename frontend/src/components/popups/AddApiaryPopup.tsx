import { Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useState } from 'react';
import { createApiary } from '../../store/store';
import { useAppDispatch } from '../../store/hooks';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import { useAuth } from 'react-oidc-context';
import InfestationLevelInput, { InfestationLevel } from '../common/InfestationLevelInput';

interface AddApiaryPopupProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSuccess?: () => void;
}

const infestationLevelMap = { 1: 'low', 2: 'moderate', 3: 'high' } as const;
const infestationLevelReverseMap = { low: 1, moderate: 2, high: 3 } as const;

export default function AddApiaryPopup({ show, onHide, latitude, longitude, onSuccess }: AddApiaryPopupProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useUserPermissions();
  const auth = useAuth();
  
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
        accessToken,
        userGuid: auth.user?.profile?.sub || ''
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

  return (
    <AppModal
      show={show}
      onHide={handleClose}
      locked
      icon={OBJECT_ICONS.apiary}
      title="Nouveau rucher"
      onSubmit={handleSubmit}
      validated={validated}
      footer={(
        <Button type="submit" variant="success" disabled={isSubmitting}>
          {isSubmitting ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Enregistrer
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Infestation</Form.Label>
        <InfestationLevelInput
          value={infestationLevelMap[infestationLevel] as InfestationLevel}
          onChange={level => setInfestationLevel(infestationLevelReverseMap[level])}
        />
      </Form.Group>

      <Form.Group className="mb-0" controlId="apiary-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Observations, mesures prises…"
          disabled={isSubmitting}
        />
      </Form.Group>
    </AppModal>
  );
}
