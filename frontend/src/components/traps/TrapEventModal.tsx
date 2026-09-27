import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner, ToggleButton } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addTrapCatch, addTrapEvent, fetchSpecies, selectSpecies, type Trap, type TrapEventKind,
} from '../../store/store';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import PhotoInput from './PhotoInput';
import SpeciesCard from './SpeciesCard';
import { SPECIES_GRID_STYLE } from './speciesGrid';
import SpeciesPicker from './SpeciesPicker';
import BycatchQuestionSheet from './BycatchQuestionSheet';
import { EVENT_KINDS, VISIT_ACTION_KINDS, eventKindInfo } from './eventKinds';

/** Local datetime string accepted by <input type="datetime-local"> */
function nowLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

/**
 * Species the reading starts with: the one the traps are there for. It is
 * recorded even at zero, which is how a visit without catch is kept.
 */
const DEFAULT_SPECIES = 'vespa-velutina';

/** Maintenance actions, offered as chips when the dialog opens for an action */
const ACTION_KINDS = EVENT_KINDS.filter((entry) => entry.value !== 'catch');

/** One card of the reading being recorded */
interface CatchLine {
  slug: string;
  quantity: number;
  photo: File | null;
}

interface TrapEventModalProps {
  /** Mounted only while open, so every opening starts from a blank form */
  onHide: () => void;
  trap: Trap | null;
  /** `catch` records a reading; any other kind opens the maintenance actions, preselected */
  initialKind?: TrapEventKind;
}

/**
 * Record an intervention on a trap: a visit (a reading, plus the actions done
 * at the same time) or a lone maintenance action.
 */
export default function TrapEventModal({ onHide, trap, initialKind = 'catch' }: TrapEventModalProps) {
  const dispatch = useAppDispatch();
  const species = useAppSelector(selectSpecies);

  const [kind, setKind] = useState<TrapEventKind>(initialKind);
  const [performedAt, setPerformedAt] = useState(nowLocal);
  const [lines, setLines] = useState<CatchLine[]>([{ slug: DEFAULT_SPECIES, quantity: 0, photo: null }]);
  const [visitActions, setVisitActions] = useState<TrapEventKind[]>([]);
  const [askingBycatch, setAskingBycatch] = useState(false);
  const [picking, setPicking] = useState(false);
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCatch = initialKind === 'catch';

  useEffect(() => {
    if (species.length === 0) {
      dispatch(fetchSpecies());
    }
  }, [species.length, dispatch]);

  // A card brought down to zero stays on screen but is not recorded, except
  // the Asian hornet's: its zero is the result of the reading
  const counted = lines.filter((line) => line.quantity > 0 || line.slug === DEFAULT_SPECIES);
  const hasBycatch = counted.some((line) => line.slug !== DEFAULT_SPECIES);

  const updateLine = (slug: string, change: Partial<CatchLine>) =>
    setLines((current) => current.map((line) => (line.slug === slug ? { ...line, ...change } : line)));

  const addLine = (slug: string) => {
    setLines((current) => [...current, { slug, quantity: 1, photo: null }]);
    setPicking(false);
  };

  const toggleVisitAction = (action: TrapEventKind) =>
    setVisitActions((current) => (current.includes(action)
      ? current.filter((item) => item !== action)
      : [...current, action]));

  const save = async (bycatchCounted: boolean) => {
    if (!trap) return;
    setAskingBycatch(false);
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
          bycatch_counted: bycatchCounted,
          actions: visitActions,
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trap) return;
    if (kind === 'catch' && counted.length === 0) {
      setError('Indiquez au moins une espèce.');
      return;
    }
    // Only the Asian hornet: ask whether the other insects were counted
    if (kind === 'catch' && !hasBycatch) {
      setAskingBycatch(true);
      return;
    }
    save(true);
  };

  return (
    <>
      <AppModal
        show={!askingBycatch}
        onHide={onHide}
        locked
        icon={eventKindInfo(kind).icon}
        title={eventKindInfo(kind).label}
        onSubmit={handleSubmit}
        footer={(
          <Button type="submit" variant="primary" disabled={saving || picking}>
            {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
            Enregistrer
          </Button>
        )}
      >
        {error && <Alert variant="danger">{error}</Alert>}

        {!isCatch && (
          <Form.Group className="mb-3">
            <div className="d-flex flex-wrap gap-2" role="radiogroup" aria-label="Type d'intervention">
              {ACTION_KINDS.map((entry) => (
                <ToggleButton
                  key={entry.value}
                  id={`event-kind-${entry.value}`}
                  type="radio"
                  name="event-kind"
                  variant="outline-primary"
                  value={entry.value}
                  checked={kind === entry.value}
                  onChange={() => setKind(entry.value)}
                  className="rounded-pill"
                >
                  <span className="me-1" aria-hidden="true">{entry.icon}</span>
                  {entry.label}
                </ToggleButton>
              ))}
            </div>
            {(kind === 'installation' || kind === 'removal') && (
              <Form.Text muted>
                {kind === 'installation'
                  ? 'Le piège sera marqué en service, à cette date.'
                  : 'Le piège sera marqué comme remisé.'}
              </Form.Text>
            )}
          </Form.Group>
        )}

        <Form.Group className="mb-3" controlId="event-performed-at">
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
            <Form.Label className="d-flex align-items-center">
              Captures
              <HelpTip id="catch-help" title="Compter les captures">
                Comptez ce que vous retirez de la zone de capture : un insecte laissé dans le piège
                serait compté une seconde fois au relevé suivant. Touchez l'image d'une espèce pour
                ajouter un individu, le nombre rouge pour saisir un total. Un relevé sans frelon
                s'enregistre à zéro : il compte autant qu'une capture pour suivre la pression.
              </HelpTip>
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

        {kind === 'catch' && !picking && (
          <Form.Group className="mb-3">
            <Form.Label>Aussi fait pendant la visite</Form.Label>
            <div className="d-flex flex-wrap gap-2">
              {VISIT_ACTION_KINDS.map((action) => {
                const info = eventKindInfo(action);
                return (
                  <ToggleButton
                    key={action}
                    id={`visit-action-${action}`}
                    type="checkbox"
                    variant="outline-primary"
                    value={action}
                    checked={visitActions.includes(action)}
                    onChange={() => toggleVisitAction(action)}
                    className="rounded-pill"
                    disabled={saving}
                  >
                    <span className="me-1" aria-hidden="true">{info.icon}</span>
                    {info.label}
                  </ToggleButton>
                );
              })}
            </div>
          </Form.Group>
        )}

        {kind !== 'catch' && (
          <PhotoInput label="Photos" multiple onChange={setPhotos} />
        )}

        <Form.Group className="mb-0" controlId="event-comments">
          <Form.Label>Commentaire</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
          />
        </Form.Group>
      </AppModal>

      <BycatchQuestionSheet
        show={askingBycatch}
        onHide={() => setAskingBycatch(false)}
        onAnswer={save}
        onCount={() => {
          setAskingBycatch(false);
          setPicking(true);
        }}
      />
    </>
  );
}
