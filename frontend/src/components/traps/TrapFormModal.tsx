import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  createTrap, updateTrap, fetchTrapTypes, selectTrapTypes, type Trap,
} from '../../store/store';
import CoordinateInput from '../common/CoordinateInput';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import { reverseGeocode } from '../../utils/geocoding';
import AddressSearch from './AddressSearch';
import PhotoInput from './PhotoInput';
import TrapTypeSelect from './TrapTypeSelect';

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
    <AppModal
      show
      onHide={onHide}
      locked
      icon={OBJECT_ICONS.trap}
      title={isEdit ? 'Modifier le piège' : 'Nouveau piège'}
      onSubmit={handleSubmit}
      footer={(
        <>
          <span className="me-auto small text-muted d-inline-flex align-items-center">
            <i className="bi bi-globe2 me-1" aria-hidden="true" />
            Public
            <HelpTip id="trap-visibility-help" title="Visibilité">
              Le piège est public par défaut : sa position et ses captures sont visibles de tous.
              La délégation à une association se règle depuis la fiche du piège.
            </HelpTip>
          </span>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label className="d-flex align-items-center">
          Type de piège
          {selectedType?.description && (
            <HelpTip id="trap-type-help" title={selectedType.name}>{selectedType.description}</HelpTip>
          )}
        </Form.Label>
        <TrapTypeSelect trapTypes={trapTypes} value={typeSlug} onChange={setTypeSlug} />
      </Form.Group>

      <Form.Group className="mb-3" controlId="trap-installed-at">
        <Form.Label>Installé le</Form.Label>
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

      <Form.Group className="mb-2" controlId="trap-address">
        <Form.Label>Adresse</Form.Label>
        <Form.Control
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Complétée depuis la position"
        />
      </Form.Group>

      {/* The position comes from the map or the address search; typed by hand only to correct it */}
      <details className="mb-3 small">
        <summary className="text-muted py-1">
          Coordonnées GPS : {lat.toFixed(5)}, {lng.toFixed(5)}
        </summary>
        <div className="d-flex flex-column gap-2 mt-2">
          <CoordinateInput label="Latitude" value={lat} onChange={setLat} precision={6} labelPosition="horizontal" />
          <CoordinateInput label="Longitude" value={lng} onChange={setLng} precision={6} labelPosition="horizontal" />
        </div>
      </details>

      <PhotoInput
        label={isEdit ? 'Remplacer la photo' : 'Photo'}
        onChange={(files) => setPhoto(files[0] ?? null)}
      />

      <Form.Group className="mb-0" controlId="trap-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="Emplacement précis, appât utilisé…"
        />
      </Form.Group>
    </AppModal>
  );
}
