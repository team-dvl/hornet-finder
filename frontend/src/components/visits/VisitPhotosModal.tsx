import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { PhotoInput } from '../common';
import { AppModal } from '../ui';
import { hiveErrorOf } from '../../utils/hivesApi';
import { addVisitPhotos, type Visit } from '../../utils/visitsApi';

interface VisitPhotosModalProps {
  visit: Visit;
  onHide: () => void;
  onDone: (visit: Visit) => void;
}

/** Add photos to a visit, of the whole apiary or of one colony. */
export default function VisitPhotosModal({ visit, onHide, onDone }: VisitPhotosModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [inspection, setInspection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await addVisitPhotos(visit.id, files, inspection ? Number(inspection) : null));
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon={<i className="bi bi-camera hive-icon" aria-hidden="true" />}
      title="Photos de la visite"
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving || !files.length}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Ajouter
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <PhotoInput label="Photos" multiple onChange={setFiles} disabled={saving} />
      {visit.inspections.length > 0 && (
        <Form.Group className="mt-3 mb-0" controlId="visit-photos-colony">
          <Form.Label>Colonie</Form.Label>
          <Form.Select value={inspection} disabled={saving} onChange={(event) => setInspection(event.target.value)}>
            <option value="">Tout le rucher</option>
            {visit.inspections.map((item) => (
              <option key={item.id} value={item.id}>{item.colony_label || item.hive_label}</option>
            ))}
          </Form.Select>
        </Form.Group>
      )}
    </AppModal>
  );
}
