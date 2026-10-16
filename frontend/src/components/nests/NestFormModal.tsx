import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import { updateNest, type Nest, type NestType, type NestUpdateValues } from '../../store/store';
import { CoordinateInput } from '../common';
import { AppModal } from '../ui';
import NestContactFields from './NestContactFields';
import { OBJECT_ICONS } from '../../utils/icons';
import { HEIGHT_CLASSES, NEST_TYPES, SIZE_CLASSES } from '../../utils/nestStatus';

interface NestFormModalProps {
  /** Mounted only while open, so every opening starts from the nest's values */
  onHide: () => void;
  nest: Nest & { id: number };
  onSaved?: (nest: Nest) => void;
}

/**
 * Edit a nest (admins, coordinators of the nest hunters): place, address,
 * comments, position, what is known of it (type, height, size) and how to
 * reach the reporter. Its
 * status goes through its journal (verification, neutralisation), not through here.
 */
export default function NestFormModal({ onHide, nest, onSaved }: NestFormModalProps) {
  const dispatch = useAppDispatch();

  const [publicPlace, setPublicPlace] = useState(Boolean(nest.public_place));
  const [address, setAddress] = useState(nest.address ?? '');
  const [comments, setComments] = useState(nest.comments ?? '');
  const [phone, setPhone] = useState(nest.contact_phone ?? '');
  const [privateComments, setPrivateComments] = useState(nest.private_comments ?? '');
  const [lat, setLat] = useState(nest.latitude);
  const [lng, setLng] = useState(nest.longitude);
  const [nestType, setNestType] = useState<NestType>(nest.nest_type ?? '');
  const [height, setHeight] = useState(nest.height_class ?? '');
  const [size, setSize] = useState(nest.size_class ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      contact_phone: phone.trim(),
      private_comments: privateComments.trim(),
      nest_type: nestType,
      height_class: height,
      size_class: size,
    };
    try {
      const saved = await dispatch(updateNest({ id: nest.id, values })).unwrap();
      onSaved?.(saved);
      onHide();
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setSaving(false);
    }
  };

  const select = (id: string, label: string, value: string, onChange: (value: string) => void,
    options: { value: string; label: string }[]) => (
    <Form.Group className="mb-3" controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Select value={value} onChange={(event) => onChange(event.target.value)} disabled={saving}>
        <option value="">Non précisé</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Form.Select>
    </Form.Group>
  );

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
        <Form.Check
          type="switch"
          id="nest-public-place"
          label="Lieu public (parc, rue…)"
          checked={publicPlace}
          disabled={saving}
          onChange={(event) => setPublicPlace(event.target.checked)}
        />
      </Form.Group>

      {select('nest-edit-type', 'Type de nid', nestType, (value) => setNestType(value as NestType), NEST_TYPES)}
      {select('nest-edit-height', 'Hauteur estimée', height, setHeight, HEIGHT_CLASSES)}
      {select('nest-edit-size', 'Taille estimée', size, setSize, SIZE_CLASSES)}

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

      <Form.Group className="mb-3" controlId="nest-edit-comments">
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

      <NestContactFields
        phone={phone}
        onPhoneChange={setPhone}
        privateComments={privateComments}
        onPrivateCommentsChange={setPrivateComments}
        asCoordinator
        disabled={saving}
      />
    </AppModal>
  );
}
