import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { setDivider } from '../../utils/coloniesApi';
import { hiveErrorOf, hiveLabel, type Hive } from '../../utils/hivesApi';

interface DividerModalProps {
  hive: Hive;
  onHide: () => void;
  onDone: (hive: Hive) => void;
}

/** Put, move or remove the divider of a top-bar hive. */
export default function DividerModal({ hive, onHide, onDone }: DividerModalProps) {
  const max = (hive.max_bars ?? 24) - 1;
  const [position, setPosition] = useState(String(hive.divider_bar ?? Math.ceil((hive.max_bars ?? 24) / 2)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const twoColonies = hive.colonies.some((colony) => colony.compartment === 2);

  const save = async (value: number | null) => {
    setSaving(true);
    setError(null);
    try {
      onDone(await setDivider(hive.id, value));
    } catch (saveError) {
      setError(hiveErrorOf(saveError));
      setSaving(false);
    }
  };

  return (
    <AppModal
      show
      onHide={onHide}
      icon={<i className="bi bi-hexagon-half hive-icon" aria-hidden="true" />}
      title="Cloison"
      onSubmit={(event) => { event.preventDefault(); void save(Number(position)); }}
      footer={(
        <>
          {hive.divider_bar && !twoColonies && (
            <Button variant="outline-danger" className="me-auto" disabled={saving} onClick={() => void save(null)}>
              <i className="bi bi-x-lg me-2" aria-hidden="true" />Retirer
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={saving || !position}>
            {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
            {hive.divider_bar ? 'Déplacer' : 'Poser'}
          </Button>
        </>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <p className="fw-semibold mb-3">{hiveLabel(hive)}</p>
      <Form.Group controlId="hive-divider-position">
        <Form.Label className="d-flex align-items-center">
          À la place de la barrette
          <HelpTip id="divider-help" doc="apiaries#colonies" title="Cloison">
            La cloison prend la place d'une barrette : le compartiment 1 est en deçà, le
            compartiment 2 au-delà. Elle se retire quand un des deux compartiments est vide.
          </HelpTip>
        </Form.Label>
        <Form.Control type="number" inputMode="numeric" min={2} max={max} value={position} required
          disabled={saving} onChange={(event) => setPosition(event.target.value)} />
      </Form.Group>
    </AppModal>
  );
}
