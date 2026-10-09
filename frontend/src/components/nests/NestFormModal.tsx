import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import { updateNest, type Nest, type NestUpdateValues } from '../../store/store';
import { CoordinateInput, HelpTip } from '../common';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import { dateInputToIso, toDateInputValue } from '../../utils/format';

interface NestFormModalProps {
  /** Mounted only while open, so every opening starts from the nest's values */
  onHide: () => void;
  nest: Nest & { id: number };
}

/**
 * Edit a nest (admins, coordinators of the nest hunters): place, address,
 * comments, position, destruction and its date. A destroyed nest only turns
 * back into an active one through an admin (`permissions.reactivate`).
 */
export default function NestFormModal({ onHide, nest }: NestFormModalProps) {
  const dispatch = useAppDispatch();
  const initialDay = nest.destroyed_at ? toDateInputValue(nest.destroyed_at) : '';

  const [publicPlace, setPublicPlace] = useState(Boolean(nest.public_place));
  const [address, setAddress] = useState(nest.address ?? '');
  const [comments, setComments] = useState(nest.comments ?? '');
  const [lat, setLat] = useState(nest.latitude);
  const [lng, setLng] = useState(nest.longitude);
  const [destroyed, setDestroyed] = useState(Boolean(nest.destroyed));
  const [destroyedDay, setDestroyedDay] = useState(initialDay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once destroyed, a nest stays so unless an admin reactivates it
  const lockedDestroyed = Boolean(nest.destroyed) && !nest.permissions?.reactivate;

  const handleDestroyed = (checked: boolean) => {
    setDestroyed(checked);
    // A new destruction defaults to today; the recorded date comes back if it is undone
    setDestroyedDay(checked ? (initialDay || toDateInputValue()) : initialDay);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values: NestUpdateValues = {
      latitude: lat,
      longitude: lng,
      public_place: publicPlace,
      address: address.trim(),
      comments: comments.trim(),
      destroyed,
    };
    // Sent only when changed, so editing something else keeps the recorded time
    if (destroyed && destroyedDay && destroyedDay !== initialDay) {
      values.destroyed_at = dateInputToIso(destroyedDay);
    }
    try {
      await dispatch(updateNest({ id: nest.id, values })).unwrap();
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
      icon={OBJECT_ICONS.nest}
      title={`Modifier le nid #${nest.id}`}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="danger" disabled={saving}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Enregistrer
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <div className="d-flex align-items-center">
          <Form.Check
            type="switch"
            id="nest-destroyed"
            label="Nid détruit"
            checked={destroyed}
            disabled={saving || lockedDestroyed}
            onChange={(event) => handleDestroyed(event.target.checked)}
          />
          <HelpTip id="nest-destroyed-help" doc="nests#report" title="Nid détruit">
            Un nid neutralisé ne peut plus être réactivé, sauf par un administrateur.
            Sa date de destruction reste modifiable.
          </HelpTip>
        </div>
      </Form.Group>

      {destroyed && (
        <Form.Group className="mb-3" controlId="nest-destroyed-at">
          <Form.Label>Détruit le</Form.Label>
          <Form.Control
            type="date"
            value={destroyedDay}
            max={toDateInputValue()}
            onChange={(event) => setDestroyedDay(event.target.value)}
            disabled={saving}
          />
        </Form.Group>
      )}

      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          id="nest-public-place"
          label="Lieu public (parc, rue…)"
          checked={publicPlace}
          disabled={saving}
          onChange={(event) => setPublicPlace(event.target.checked)}
        />
      </Form.Group>

      <Form.Group className="mb-2" controlId="nest-edit-address">
        <Form.Label>Adresse</Form.Label>
        <Form.Control
          type="text"
          value={address}
          maxLength={255}
          onChange={(event) => setAddress(event.target.value)}
          disabled={saving}
        />
      </Form.Group>

      {/* Typed by hand only to correct a misplaced report */}
      <details className="mb-3 small">
        <summary className="text-muted py-1">
          Coordonnées GPS : {lat.toFixed(5)}, {lng.toFixed(5)}
        </summary>
        <div className="d-flex flex-column gap-2 mt-2">
          <CoordinateInput label="Latitude" value={lat} onChange={setLat} precision={6} labelPosition="horizontal" />
          <CoordinateInput label="Longitude" value={lng} onChange={setLng} precision={6} labelPosition="horizontal" />
        </div>
      </details>

      <Form.Group className="mb-0" controlId="nest-edit-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="Taille, accessibilité, danger…"
          disabled={saving}
        />
      </Form.Group>
    </AppModal>
  );
}
