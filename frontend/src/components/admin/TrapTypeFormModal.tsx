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
  const [apiaryBound, setApiaryBound] = useState(trapType?.apiary_bound ?? false);
  const [accumulates, setAccumulates] = useState(trapType?.accumulates ?? false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const values = {
        name, description, sort_order: sortOrder, apiary_bound: apiaryBound, accumulates, photo,
      };
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

      <Form.Group className="mb-3 d-flex align-items-center">
        <Form.Check
          type="switch"
          id="trap-type-apiary-bound"
          label="Lié à un rucher"
          checked={apiaryBound}
          onChange={(event) => setApiaryBound(event.target.checked)}
        />
        <HelpTip id="apiary-bound-help" title="Lié à un rucher">
          Ces pièges ne s'installent que devant des ruches : les montrer révélerait un rucher.
          Ils ne sont visibles que de leur propriétaire, du groupe à qui l'entretien est délégué et des admins.
        </HelpTip>
      </Form.Group>

      <Form.Group className="mb-3 d-flex align-items-center">
        <Form.Check
          type="switch"
          id="trap-type-accumulates"
          label="Accumule les captures"
          checked={accumulates}
          onChange={(event) => setAccumulates(event.target.checked)}
        />
        <HelpTip id="accumulates-help" title="Accumule les captures">
          Les prises restent dans le piège d'un relevé à l'autre (harpe, nasse, piège létal...) :
          on compte ce qu'il contient et l'on indique s'il a été vidé, l'application en déduit les
          nouvelles prises. Sinon (filet...), chaque relevé retire tout ce qui a été pris.
        </HelpTip>
      </Form.Group>

      <PhotoInput
        label={trapType?.photo_url ? 'Remplacer la photo' : 'Photo'}
        onChange={(files) => setPhoto(files[0] ?? null)}
      />
    </AppModal>
  );
}
