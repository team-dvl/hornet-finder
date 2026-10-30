import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal, Switch } from '../ui';
import {
  BAR_FAMILY_LABELS, hiveErrorOf, saveHiveType, type BarFamily, type HiveType,
} from '../../utils/hivesApi';

interface HiveTypeFormModalProps {
  onHide: () => void;
  hiveType: HiveType | null;
  onSaved: () => void;
}

const FAMILIES: BarFamily[] = ['topbar', 'warre', ''];

/** Create or edit a hive type: its bars and how many colonies it holds. */
export default function HiveTypeFormModal({ onHide, hiveType, onSaved }: HiveTypeFormModalProps) {
  const [name, setName] = useState(hiveType?.name ?? '');
  const [description, setDescription] = useState(hiveType?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(hiveType?.sort_order ?? 0));
  const [family, setFamily] = useState<BarFamily>(hiveType?.bar_family ?? 'topbar');
  const [maxBars, setMaxBars] = useState(String(hiveType?.max_bars ?? ''));
  const [barsPerBox, setBarsPerBox] = useState(String(hiveType?.bars_per_box ?? ''));
  const [twoColonies, setTwoColonies] = useState((hiveType?.max_colonies ?? 1) > 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveHiveType(hiveType?.id ?? null, {
        name: name.trim(),
        description: description.trim(),
        sort_order: Number(sortOrder) || 0,
        bar_family: family,
        max_bars: family === 'topbar' ? Number(maxBars) || null : null,
        bars_per_box: family === 'warre' ? Number(barsPerBox) || null : null,
        max_colonies: family === 'topbar' && twoColonies ? 2 : 1,
      });
      onSaved();
      onHide();
    } catch (saveError) {
      setError(hiveErrorOf(saveError));
      setSaving(false);
    }
  };

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon={<i className="bi bi-hexagon-half hive-icon" aria-hidden="true" />}
      title={hiveType ? 'Modifier le type de ruche' : 'Nouveau type de ruche'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving || !name.trim()}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          {hiveType ? 'Enregistrer' : 'Ajouter'}
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Form.Group className="mb-3" controlId="hive-type-name">
        <Form.Label>Nom</Form.Label>
        <Form.Control type="text" value={name} maxLength={128} required disabled={saving}
          onChange={(event) => setName(event.target.value)} />
      </Form.Group>

      <Form.Group className="mb-3" controlId="hive-type-family">
        <Form.Label className="d-flex align-items-center">
          Barrettes
          <HelpTip id="hive-type-family-help" doc="admin#referentials" title="Famille de barrettes">
            Les barrettes d'une même famille sont interchangeables : une colonie passe d'un nucleus à
            une TBH avec ses rayons. Les barrettes Warré forment une famille à part.
          </HelpTip>
        </Form.Label>
        <Form.Select value={family} disabled={saving}
          onChange={(event) => setFamily(event.target.value as BarFamily)}>
          {FAMILIES.map((value) => <option key={value} value={value}>{BAR_FAMILY_LABELS[value]}</option>)}
        </Form.Select>
      </Form.Group>

      {family === 'topbar' && (
        <>
          <Form.Group className="mb-3" controlId="hive-type-max-bars">
            <Form.Label>Barrettes au maximum</Form.Label>
            <Form.Control type="number" inputMode="numeric" min={1} max={99} value={maxBars} required
              disabled={saving} onChange={(event) => setMaxBars(event.target.value)} />
          </Form.Group>
          <div className="mb-3">
            <Switch
              id="hive-type-two-colonies"
              label="Deux colonies avec une cloison"
              checked={twoColonies}
              disabled={saving}
              onChange={setTwoColonies}
            />
          </div>
        </>
      )}

      {family === 'warre' && (
        <Form.Group className="mb-3" controlId="hive-type-bars-per-box">
          <Form.Label>Barrettes par élément</Form.Label>
          <Form.Control type="number" inputMode="numeric" min={1} max={30} value={barsPerBox} required
            disabled={saving} onChange={(event) => setBarsPerBox(event.target.value)} />
        </Form.Group>
      )}

      <Form.Group className="mb-3" controlId="hive-type-description">
        <Form.Label>Description</Form.Label>
        <Form.Control as="textarea" rows={2} value={description} disabled={saving}
          onChange={(event) => setDescription(event.target.value)} />
      </Form.Group>

      <Form.Group className="mb-0" controlId="hive-type-order">
        <Form.Label>Ordre d'affichage</Form.Label>
        <Form.Control type="number" inputMode="numeric" value={sortOrder} disabled={saving}
          onChange={(event) => setSortOrder(event.target.value)} />
      </Form.Group>
    </AppModal>
  );
}
