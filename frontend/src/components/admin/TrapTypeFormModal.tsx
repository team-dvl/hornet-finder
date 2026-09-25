import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { useAppDispatch } from '../../store/hooks';
import { createTrapType, updateTrapType, type TrapType } from '../../store/store';
import { PhotoInput } from '../traps';

interface TrapTypeFormModalProps {
  /** Mounted only while open, so every opening starts from the right values */
  onHide: () => void;
  /** Existing entry to edit; a new one is created when absent */
  trapType?: TrapType | null;
}

export default function TrapTypeFormModal({ onHide, trapType = null }: TrapTypeFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(trapType);

  const [name, setName] = useState(trapType?.name ?? '');
  const [description, setDescription] = useState(trapType?.description ?? '');
  const [sortOrder, setSortOrder] = useState(trapType?.sort_order ?? 0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const values = { name, description, sort_order: sortOrder, photo };
      if (trapType) {
        await dispatch(updateTrapType({ id: trapType.id, values })).unwrap();
      } else {
        // The backend derives the technical identifier from the name
        await dispatch(createTrapType(values)).unwrap();
      }
      onHide();
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon="🪤"
      title={isEdit ? 'Modifier le type de piège' : 'Ajouter un type de piège'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="primary" disabled={saving || !name}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Enregistrer
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Nom</Form.Label>
        <Form.Control
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="d-flex align-items-center">
          Ordre d'affichage
          <HelpTip id="sort-order-help" title="Ordre d'affichage">Les valeurs les plus basses apparaissent en premier.</HelpTip>
        </Form.Label>
        <Form.Control
          type="number"
          value={sortOrder}
          onChange={(event) => setSortOrder(Number(event.target.value))}
        />
      </Form.Group>

      <PhotoInput
        label={trapType?.photo_url ? 'Remplacer la photo' : 'Photo'}
        onChange={(files) => setPhoto(files[0] ?? null)}
      />
    </AppModal>
  );
}
