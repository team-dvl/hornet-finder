import { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  createTrap, updateTrap, fetchTrapTypes, selectTrapTypes, type Trap,
} from '../../store/store';
import CoordinateInput from '../common/CoordinateInput';
import { reverseGeocode } from '../../utils/geocoding';
import AddressSearch from './AddressSearch';
import PhotoInput from './PhotoInput';

interface TrapFormModalProps {
  /** Mounted only while open, so every opening starts from the right values */
  onHide: () => void;
  /** Position picked on the map, for a new trap */
  latitude?: number;
  longitude?: number;
  /** When set, the form edits this trap instead of creating one */
  trap?: Trap | null;
  onSaved?: (trap: Trap) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Create or edit a trap: type, position, installation date, photo, comments. */
export default function TrapFormModal({
  onHide, latitude, longitude, trap = null, onSaved,
}: TrapFormModalProps) {
  const dispatch = useAppDispatch();
  const trapTypes = useAppSelector(selectTrapTypes);
  const isEdit = Boolean(trap);

  const [typeSlug, setTypeSlug] = useState(trap?.trap_type.slug ?? '');
  const [lat, setLat] = useState(trap?.latitude ?? latitude ?? 0);
  const [lng, setLng] = useState(trap?.longitude ?? longitude ?? 0);
  const [address, setAddress] = useState(trap?.address ?? '');
  const [installedAt, setInstalledAt] = useState(trap?.installed_at ?? today());
  const [comments, setComments] = useState(trap?.comments ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trapTypes.length === 0) {
      dispatch(fetchTrapTypes());
    }
  }, [trapTypes.length, dispatch]);

  // Fill the address from the position, unless the user already has one
  useEffect(() => {
    if (trap || !lat || !lng || address) return;
    let cancelled = false;
    reverseGeocode(lat, lng).then((found) => {
      if (!cancelled && found) setAddress(found);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!typeSlug) {
      setError('Choisissez un type de piège.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const values = {
        latitude: lat,
        longitude: lng,
        trap_type_slug: typeSlug,
        installed_at: installedAt,
        address,
        comments,
        photo,
      };
      const saved = trap
        ? await dispatch(updateTrap({ trapId: trap.id, values })).unwrap()
        : await dispatch(createTrap(values)).unwrap();
      onSaved?.(saved);
      onHide();
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setSaving(false);
    }
  };

  const selectedType = trapTypes.find((type) => type.slug === typeSlug);

  return (
    <Modal show onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="me-2">🪤</span>
          {isEdit ? 'Modifier le piège' : 'Ajouter un piège'}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Type de piège</Form.Label>
            <Form.Select value={typeSlug} onChange={(event) => setTypeSlug(event.target.value)} required>
              <option value="">Choisissez un type…</option>
              {trapTypes.map((type) => (
                <option key={type.slug} value={type.slug}>{type.name}</option>
              ))}
            </Form.Select>
            {selectedType?.description && (
              <Form.Text muted>{selectedType.description}</Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Date d'installation</Form.Label>
            <Form.Control
              type="date"
              value={installedAt}
              max={today()}
              onChange={(event) => setInstalledAt(event.target.value)}
              required
            />
          </Form.Group>

          <AddressSearch
            onSelect={(suggestion) => {
              setLat(suggestion.latitude);
              setLng(suggestion.longitude);
              setAddress(suggestion.displayName);
            }}
          />

          <div className="d-flex flex-column gap-3 mb-3">
            <CoordinateInput
              label="Latitude"
              value={lat}
              onChange={setLat}
              precision={6}
              labelPosition="horizontal"
            />
            <CoordinateInput
              label="Longitude"
              value={lng}
              onChange={setLng}
              precision={6}
              labelPosition="horizontal"
            />
          </div>

          <Form.Group className="mb-3">
            <Form.Label>Adresse</Form.Label>
            <Form.Control
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Complétée automatiquement depuis la position"
            />
          </Form.Group>

          <PhotoInput
            label={isEdit ? 'Remplacer la photo' : 'Photo du piège (facultatif)'}
            onChange={(files) => setPhoto(files[0] ?? null)}
          />

          <Form.Group className="mb-3">
            <Form.Label>Commentaire</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Emplacement précis, appât utilisé…"
            />
          </Form.Group>

          <Alert variant="light" className="small mb-0">
            Le piège est <strong>public</strong> par défaut : sa position et ses prises sont
            visibles de tous. La délégation à une association se règle depuis la fiche du piège.
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving && <Spinner animation="border" size="sm" className="me-2" />}
            {isEdit ? 'Enregistrer' : 'Ajouter le piège'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
