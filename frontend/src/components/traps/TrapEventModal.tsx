import { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addTrapCatch, addTrapEvent, fetchSpecies, selectSpecies, type Trap, type TrapEventKind,
} from '../../store/store';
import PhotoInput from './PhotoInput';
import SpeciesCard from './SpeciesCard';
import { SPECIES_GRID_STYLE } from './speciesGrid';
import SpeciesPicker from './SpeciesPicker';
import { EVENT_KINDS, eventKindInfo } from './eventKinds';

/** Local datetime string accepted by <input type="datetime-local"> */
function nowLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

/** Species the catch starts with: the one the traps are there for */
const DEFAULT_SPECIES = 'vespa-velutina';

/** One card of the catch being recorded */
interface CatchLine {
  slug: string;
  quantity: number;
  photo: File | null;
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
  const [lines, setLines] = useState<CatchLine[]>([{ slug: DEFAULT_SPECIES, quantity: 1, photo: null }]);
  const [picking, setPicking] = useState(false);
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (species.length === 0) {
      dispatch(fetchSpecies());
    }
  }, [species.length, dispatch]);

  // A card brought down to zero stays on screen but is not recorded
  const counted = lines.filter((line) => line.quantity > 0);

  const updateLine = (slug: string, change: Partial<CatchLine>) =>
    setLines((current) => current.map((line) => (line.slug === slug ? { ...line, ...change } : line)));

  const addLine = (slug: string) => {
    setLines((current) => [...current, { slug, quantity: 1, photo: null }]);
    setPicking(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trap) return;
    if (kind === 'catch' && counted.length === 0) {
      setError('Indiquez au moins une capture.');
      return;
    }
    setSaving(true);
    setError(null);
    // The input has no timezone, the browser's one applies
    const performed_at = new Date(performedAt).toISOString();
    try {
      if (kind === 'catch') {
        await dispatch(addTrapCatch({
          trapId: trap.id,
          performed_at,
          comments,
          items: counted.map(({ slug, quantity, photo }) => ({ species_slug: slug, quantity, photo })),
        })).unwrap();
      } else {
        await dispatch(addTrapEvent({ trapId: trap.id, kind, performed_at, comments, photos })).unwrap();
      }
      onHide();
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">{eventKindInfo(kind).icon}</span>
          {kind === 'catch' ? 'Enregistrer une capture' : 'Ajouter une action'}
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
            <Form.Group className="mb-3">
              <Form.Label className="d-flex justify-content-between align-items-baseline">
                <span>Captures constatées</span>
                {!picking && (
                  <Form.Text muted className="m-0">
                    Touchez une image pour compter
                  </Form.Text>
                )}
              </Form.Label>
              {picking ? (
                <SpeciesPicker
                  species={species}
                  excluded={lines.map((line) => line.slug)}
                  onPick={addLine}
                  onCancel={() => setPicking(false)}
                />
              ) : (
                <div style={SPECIES_GRID_STYLE}>
                  {lines.map((line) => (
                    <SpeciesCard
                      key={line.slug}
                      species={species.find((item) => item.slug === line.slug)}
                      fallbackName={line.slug}
                      quantity={line.quantity}
                      photo={line.photo}
                      onQuantityChange={(quantity) => updateLine(line.slug, { quantity })}
                      onPhotoChange={(photo) => updateLine(line.slug, { photo })}
                      onRemove={() => setLines((current) => current.filter((l) => l.slug !== line.slug))}
                      disabled={saving}
                    />
                  ))}
                  <button
                    type="button"
                    className="card d-flex flex-column align-items-center justify-content-center text-muted p-2"
                    style={{ borderStyle: 'dashed', minHeight: 120 }}
                    onClick={() => setPicking(true)}
                    disabled={saving}
                  >
                    <i className="bi bi-plus-circle fs-3" aria-hidden="true" />
                    <span className="small">Ajouter une espèce</span>
                  </button>
                </div>
              )}
            </Form.Group>
          )}

          {kind !== 'catch' && (
            <PhotoInput label="Photos (facultatif)" multiple onChange={setPhotos} />
          )}

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
          <Button type="submit" variant="primary" disabled={saving || picking}>
            {saving && <Spinner animation="border" size="sm" className="me-2" />}
            Enregistrer
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
