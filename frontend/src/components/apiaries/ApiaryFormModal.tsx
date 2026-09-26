import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAppDispatch } from '../../store/hooks';
import { createApiary, updateApiary, type Apiary } from '../../store/store';
import { HelpTip, InfestationLevelInput, type InfestationLevel } from '../common';
import CoordinateInput from '../common/CoordinateInput';
import { AddressSearch, PhotoInput } from '../traps';
import { AppModal } from '../ui';
import { OBJECT_ICONS } from '../../utils/icons';
import { reverseGeocode } from '../../utils/geocoding';

interface ApiaryFormModalProps {
  /** Mounted only while open, so every opening starts from the right values */
  onHide: () => void;
  /** Position picked on the map, for a new apiary */
  latitude?: number;
  longitude?: number;
  /** When set, the form edits this apiary instead of creating one */
  apiary?: Apiary | null;
  onSaved?: (apiary: Apiary) => void;
}

const LEVEL_NAMES = { 1: 'low', 2: 'moderate', 3: 'high' } as const;
const LEVEL_VALUES = { low: 1, moderate: 2, high: 3 } as const;

/** Create or edit an apiary: infestation, position, AFSCA number, photo, comments. */
export default function ApiaryFormModal({
  onHide, latitude, longitude, apiary = null, onSaved,
}: ApiaryFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(apiary);

  const [infestationLevel, setInfestationLevel] = useState<1 | 2 | 3>(apiary?.infestation_level ?? 1);
  const [lat, setLat] = useState(apiary?.latitude ?? latitude ?? 0);
  const [lng, setLng] = useState(apiary?.longitude ?? longitude ?? 0);
  const [address, setAddress] = useState(apiary?.address ?? '');
  const [afscaNumber, setAfscaNumber] = useState(apiary?.afsca_number ?? '');
  const [comments, setComments] = useState(apiary?.comments ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the address from the position, unless the user already has one
  useEffect(() => {
    if (!lat || !lng || address) return;
    let cancelled = false;
    reverseGeocode(lat, lng).then((found) => {
      if (!cancelled && found) setAddress(found);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values = {
      latitude: lat,
      longitude: lng,
      address: address.trim(),
      infestation_level: infestationLevel,
      afsca_number: afscaNumber.trim(),
      comments: comments.trim(),
      photo,
    };
    try {
      const saved = apiary?.id
        ? await dispatch(updateApiary({ id: apiary.id, values })).unwrap()
        : await dispatch(createApiary(values)).unwrap();
      onSaved?.(saved);
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
      icon={OBJECT_ICONS.apiary}
      title={isEdit ? 'Modifier le rucher' : 'Nouveau rucher'}
      onSubmit={handleSubmit}
      footer={(
        <>
          <span className="me-auto small text-muted d-inline-flex align-items-center">
            <i className="bi bi-lock me-1" aria-hidden="true" />
            Privé
            <HelpTip id="apiary-visibility-help" title="Visibilité">
              Un rucher n'est visible que de vous. Le partage avec une association se règle
              depuis la fiche du rucher.
            </HelpTip>
          </span>
          <Button type="submit" variant="success" disabled={saving}>
            {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Infestation</Form.Label>
        <InfestationLevelInput
          value={LEVEL_NAMES[infestationLevel] as InfestationLevel}
          onChange={(level) => setInfestationLevel(LEVEL_VALUES[level])}
        />
      </Form.Group>

      <AddressSearch
        onSelect={(suggestion) => {
          setLat(suggestion.latitude);
          setLng(suggestion.longitude);
          setAddress(suggestion.displayName);
        }}
      />

      <Form.Group className="mb-2" controlId="apiary-address">
        <Form.Label>Adresse</Form.Label>
        <Form.Control
          type="text"
          value={address}
          maxLength={255}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Complétée depuis la position"
          disabled={saving}
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

      <Form.Group className="mb-3" controlId="apiary-afsca">
        <Form.Label className="d-flex align-items-center">
          N° AFSCA
          <HelpTip id="apiary-afsca-help" title="Numéro AFSCA">
            Numéro d'enregistrement du rucher auprès de l'Agence fédérale pour la sécurité de la
            chaîne alimentaire. Facultatif.
          </HelpTip>
        </Form.Label>
        <Form.Control
          type="text"
          value={afscaNumber}
          maxLength={32}
          autoComplete="off"
          onChange={(event) => setAfscaNumber(event.target.value)}
          disabled={saving}
        />
      </Form.Group>

      <PhotoInput
        label={apiary?.photo_url ? 'Remplacer la photo' : 'Photo'}
        onChange={(files) => setPhoto(files[0] ?? null)}
        disabled={saving}
      />

      <Form.Group className="mb-0" controlId="apiary-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="Observations, mesures prises…"
          disabled={saving}
        />
      </Form.Group>
    </AppModal>
  );
}
