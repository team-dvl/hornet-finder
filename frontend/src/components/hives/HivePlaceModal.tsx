import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import {
  fetchPlaceableApiaries, hiveErrorOf, hiveLabel, moveHive, retireHive, storeHive, today,
  type Hive, type PlaceableApiary,
} from '../../utils/hivesApi';

export type PlaceMode = 'move' | 'store' | 'retire';

const TITLES: Record<PlaceMode, string> = {
  move: 'Déplacer la ruche',
  store: 'Remiser la ruche',
  retire: 'Réformer la ruche',
};

const SUBMITS: Record<PlaceMode, { label: string; icon: string; variant: string }> = {
  move: { label: 'Déplacer', icon: 'arrows-move', variant: 'primary' },
  store: { label: 'Remiser', icon: 'box-seam', variant: 'warning' },
  retire: { label: 'Réformer', icon: 'x-octagon', variant: 'danger' },
};

interface HivePlaceModalProps {
  mode: PlaceMode;
  hive: Hive;
  onHide: () => void;
  onDone: (hive: Hive) => void;
}

/**
 * Where a hive stands, on a given day: moved to an apiary (or back in
 * service), stored, or retired for good. The period it ends is closed on
 * that day, so its history stays exact.
 */
export default function HivePlaceModal({ mode, hive, onHide, onDone }: HivePlaceModalProps) {
  const { isAdmin } = useUserPermissions();
  const [apiaries, setApiaries] = useState<PlaceableApiary[] | null>(null);
  const [apiary, setApiary] = useState<number | null>(null);
  const [on, setOn] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'move') return;
    let cancelled = false;
    fetchPlaceableApiaries(isAdmin)
      .then((found) => {
        if (cancelled) return;
        // Not where it already stands
        setApiaries(found.filter((option) => option.id !== hive.apiary?.id));
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [mode, isAdmin, hive.apiary?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'move' && !apiary) return;
    setSaving(true);
    setError(null);
    try {
      const saved = mode === 'move'
        ? await moveHive(hive.id, apiary!, on)
        : mode === 'store' ? await storeHive(hive.id, on) : await retireHive(hive.id, on);
      onDone(saved);
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  const submit = SUBMITS[mode];

  return (
    <AppModal
      show
      onHide={onHide}
      icon={<i className="bi bi-hexagon-half hive-icon" aria-hidden="true" />}
      title={TITLES[mode]}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant={submit.variant} disabled={saving || (mode === 'move' && !apiary)}>
          {saving
            ? <Spinner animation="border" size="sm" className="me-2" />
            : <i className={`bi bi-${submit.icon} me-2`} aria-hidden="true" />}
          {submit.label}
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <p className="fw-semibold mb-3">{hiveLabel(hive)}</p>

      {mode === 'move' && (
        <Form.Group className="mb-3" controlId="hive-move-apiary">
          <Form.Label className="d-flex align-items-center">
            Vers le rucher
            <HelpTip id="hive-move-help" doc="apiaries#hives" title="Déplacer une ruche">
              Seuls les ruchers que vous pouvez modifier sont proposés : les vôtres, et ceux que
              votre association partage avec le droit de modification.
            </HelpTip>
          </Form.Label>
          {apiaries === null && !error && <div><Spinner animation="border" size="sm" /></div>}
          {apiaries?.length === 0 && <p className="text-muted mb-0">Aucun autre rucher.</p>}
          {apiaries && apiaries.length > 0 && (
            <Form.Select
              value={apiary ?? ''}
              onChange={(event) => setApiary(event.target.value ? Number(event.target.value) : null)}
              disabled={saving}
              required
            >
              <option value="">Choisir…</option>
              {apiaries.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Form.Select>
          )}
        </Form.Group>
      )}

      {mode === 'retire' && (
        <Alert variant="warning" className="py-2 small">
          Une ruche réformée sort de l'usage ; son historique est conservé.
        </Alert>
      )}

      <Form.Group className="mb-0" controlId="hive-place-on">
        <Form.Label>Le</Form.Label>
        <Form.Control
          type="date"
          value={on}
          max={today()}
          onChange={(event) => setOn(event.target.value)}
          disabled={saving}
          required
        />
      </Form.Group>
    </AppModal>
  );
}
