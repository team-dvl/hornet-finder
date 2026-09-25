import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { useAppDispatch } from '../../store/hooks';
import { createSpecies, updateSpecies, type Species } from '../../store/store';
import { PhotoInput } from '../traps';

interface SpeciesFormModalProps {
  /** Mounted only while open, so every opening starts from the right values */
  onHide: () => void;
  /** Existing entry to edit; a new one is created when absent */
  species?: Species | null;
}

export default function SpeciesFormModal({ onHide, species = null }: SpeciesFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(species);

  const [name, setName] = useState(species?.name ?? '');
  const [scientificName, setScientificName] = useState(species?.scientific_name ?? '');
  const [wikipediaUrl, setWikipediaUrl] = useState(species?.wikipedia_url ?? '');
  const [sortOrder, setSortOrder] = useState(species?.sort_order ?? 0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const values = {
        name,
        scientific_name: scientificName,
        wikipedia_url: wikipediaUrl,
        sort_order: sortOrder,
        photo,
      };
      if (species) {
        await dispatch(updateSpecies({ id: species.id, values })).unwrap();
      } else {
        // The backend derives the technical identifier from the names
        await dispatch(createSpecies(values)).unwrap();
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
      icon="🪲"
      title={isEdit ? "Modifier l'espèce" : 'Ajouter une espèce'}
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
        <Form.Label>Nom commun</Form.Label>
        <Form.Control
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Nom scientifique</Form.Label>
        <Form.Control
          type="text"
          className="fst-italic"
          value={scientificName}
          onChange={(event) => setScientificName(event.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Article Wikipédia</Form.Label>
        <Form.Control
          type="url"
          placeholder="https://fr.wikipedia.org/wiki/…"
          value={wikipediaUrl}
          onChange={(event) => setWikipediaUrl(event.target.value)}
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
        label={species?.photo_url ? 'Remplacer la photo' : 'Photo'}
        onChange={(files) => setPhoto(files[0] ?? null)}
      />
      {species?.photo_credit && (
        <Form.Text muted className="d-block">
          Photo actuelle : {species.photo_credit}
        </Form.Text>
      )}
    </AppModal>
  );
}
