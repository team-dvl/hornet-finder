import { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addTrapEvent, fetchSpecies, selectSpecies, type Trap, type TrapEventKind,
} from '../../store/store';
import PhotoInput from './PhotoInput';
import { EVENT_KINDS, eventKindInfo } from './eventKinds';

/** Local datetime string accepted by <input type="datetime-local"> */
function nowLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

interface TrapEventModalProps {
  /** Mounted only while open, so every opening starts from a blank form */
  onHide: () => void;
  trap: Trap | null;
  /** Kind preselected when opening, e.g. `catch` from the "record a catch" button */
  initialKind?: TrapEventKind;
}

/** Record an intervention on a trap: a catch or a maintenance action. */
export default function TrapEventModal({ onHide, trap, initialKind = 'catch' }: TrapEventModalProps) {
  const dispatch = useAppDispatch();
  const species = useAppSelector(selectSpecies);

  const [kind, setKind] = useState<TrapEventKind>(initialKind);
  const [performedAt, setPerformedAt] = useState(nowLocal);
  const [speciesSlug, setSpeciesSlug] = useState('vespa-velutina');
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (species.length === 0) {
      dispatch(fetchSpecies());
    }
  }, [species.length, dispatch]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trap) return;
    setSaving(true);
    setError(null);
    try {
      await dispatch(addTrapEvent({
        trapId: trap.id,
        kind,
        // The input has no timezone, the browser's one applies
        performed_at: new Date(performedAt).toISOString(),
        species_slug: speciesSlug,
        quantity,
        comments,
        photos,
      })).unwrap();
      onHide();
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setSaving(false);
    }
  };

  const selectedSpecies = species.find((item) => item.slug === speciesSlug);

  return (
    <Modal show onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">{eventKindInfo(kind).icon}</span>
          {kind === 'catch' ? 'Enregistrer une prise' : 'Ajouter une action'}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Type d'intervention</Form.Label>
            <Form.Select value={kind} onChange={(event) => setKind(event.target.value as TrapEventKind)}>
              {EVENT_KINDS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.icon} {entry.label}
                </option>
              ))}
            </Form.Select>
            {(kind === 'installation' || kind === 'removal') && (
              <Form.Text muted>
                {kind === 'installation'
                  ? 'Le piège sera marqué en service, à cette date.'
                  : 'Le piège sera marqué comme remisé.'}
              </Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Date et heure</Form.Label>
            <Form.Control
              type="datetime-local"
              value={performedAt}
              max={nowLocal()}
              onChange={(event) => setPerformedAt(event.target.value)}
              required
            />
          </Form.Group>

          {kind === 'catch' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Espèce</Form.Label>
                <Form.Select
                  value={speciesSlug}
                  onChange={(event) => setSpeciesSlug(event.target.value)}
                >
                  {species.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}{item.scientific_name ? ` — ${item.scientific_name}` : ''}
                    </option>
                  ))}
                </Form.Select>
                {selectedSpecies?.wikipedia_url && (
                  <Form.Text>
                    <a href={selectedSpecies.wikipedia_url} target="_blank" rel="noopener">
                      Fiche Wikipédia de {selectedSpecies.name}
                    </a>
                  </Form.Text>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Quantité constatée</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  required
                />
              </Form.Group>
            </>
          )}

          <PhotoInput label="Photos (facultatif)" multiple onChange={setPhotos} />

          <Form.Group className="mb-0">
            <Form.Label>Commentaire</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving && <Spinner animation="border" size="sm" className="me-2" />}
            Enregistrer
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
