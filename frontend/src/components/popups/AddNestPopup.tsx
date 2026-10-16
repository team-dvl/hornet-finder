import { useEffect, useState } from 'react';
import { Button, Form, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { useAppDispatch } from '../../store/hooks';
import { createNest, type Nest } from '../../store/store';
import { AppModal } from '../ui';
import { HelpTip } from '../common';
import { PhotoInput } from '../traps';
import { ChipChoice, NestContactFields } from '../nests';
import { OBJECT_ICONS } from '../../utils/icons';
import { reverseGeocode } from '../../utils/geocoding';
import { HEIGHT_CLASSES } from '../../utils/nestStatus';

type NestState = 'active' | 'empty' | 'unknown';

const STATES: { value: NestState; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'empty', label: 'Vide' },
  { value: 'unknown', label: 'Je ne sais pas' },
];

interface AddNestPopupProps {
  show: boolean;
  onHide: () => void;
  latitude: number;
  longitude: number;
  onSuccess?: (nest: Nest) => void;
}

/**
 * Report a nest at a position: photos first (they let a coordinator confirm
 * the species), what state it is in (an empty nest is recorded as abandoned),
 * the place, its height if known, and how a coordinator may call back.
 */
export default function AddNestPopup({ show, onHide, latitude, longitude, onSuccess }: AddNestPopupProps) {
  const [state, setState] = useState<NestState>('active');
  const [publicPlace, setPublicPlace] = useState(false);
  const [height, setHeight] = useState('');
  const [address, setAddress] = useState('');
  const [comments, setComments] = useState('');
  const [phone, setPhone] = useState('');
  const [privateComments, setPrivateComments] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();
  const dispatch = useAppDispatch();

  // The address of the position, editable
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    reverseGeocode(latitude, longitude).then((found) => {
      if (found && !cancelled) setAddress((typed) => typed || found);
    });
    return () => { cancelled = true; };
  }, [show, latitude, longitude]);

  const reset = () => {
    setState('active');
    setPublicPlace(false);
    setHeight('');
    setAddress('');
    setComments('');
    setPhone('');
    setPrivateComments('');
    setPhotos([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.isAuthenticated) {
      setError('Vous devez être connecté pour signaler un nid');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nest = await dispatch(createNest({
        latitude,
        longitude,
        public_place: publicPlace,
        address: address.trim() || undefined,
        comments: comments.trim() || undefined,
        contact_phone: phone.trim() || undefined,
        private_comments: privateComments.trim() || undefined,
        state,
        height_class: height || undefined,
        photos,
      })).unwrap();
      reset();
      onHide();
      onSuccess?.(nest);
    } catch (submitError) {
      setError(submitError as string);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onHide();
  };

  return (
    <AppModal
      show={show}
      onHide={handleClose}
      locked
      icon={OBJECT_ICONS.nest}
      title="Signaler un nid"
      onSubmit={handleSubmit}
      footer={(
        <Button variant="danger" type="submit" disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Signaler
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <PhotoInput label="Photos" multiple onChange={setPhotos} disabled={loading} />

      <Form.Group className="my-3">
        <Form.Label className="d-flex align-items-center">
          État du nid
          <HelpTip id="report-state-help" doc="nests#report" title="État du nid">
            Actif : des frelons entrent et sortent. Vide : le nid est abandonné, par exemple un nid de
            l&apos;an passé découvert quand les feuilles tombent ; il est enregistré comme abandonné et ne
            déclenche aucune alerte aux apiculteurs.
          </HelpTip>
        </Form.Label>
        <ChipChoice name="report-state" label="État du nid" options={STATES} value={state}
          onChange={(value) => setState((value || 'active') as NestState)} disabled={loading} />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          id="publicPlace"
          label="Lieu public (parc, rue…)"
          checked={publicPlace}
          onChange={(e) => setPublicPlace(e.target.checked)}
          disabled={loading}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Hauteur estimée <span className="text-muted fw-normal">facultatif</span></Form.Label>
        <ChipChoice name="report-height" label="Hauteur estimée" options={HEIGHT_CLASSES} value={height}
          onChange={(value) => setHeight(value as string)} clearable disabled={loading} />
      </Form.Group>

      <Form.Group className="mb-3" controlId="nest-address">
        <Form.Label>Adresse</Form.Label>
        <Form.Control
          type="text"
          placeholder="Déduite de la position si vide"
          value={address}
          maxLength={255}
          onChange={(e) => setAddress(e.target.value)}
          disabled={loading}
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="nest-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          placeholder="Où exactement, accessibilité, danger…"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          disabled={loading}
        />
      </Form.Group>

      <NestContactFields
        phone={phone}
        onPhoneChange={setPhone}
        privateComments={privateComments}
        onPrivateCommentsChange={setPrivateComments}
        disabled={loading}
      />
    </AppModal>
  );
}
