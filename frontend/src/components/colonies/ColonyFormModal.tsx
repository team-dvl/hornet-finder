import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import {
  compartmentCapacity, countLabel, countOf, createColony, updateColony, type Colony, type NewColonyValues,
} from '../../utils/coloniesApi';
import { hiveErrorOf, hiveLabel, today, type Hive } from '../../utils/hivesApi';

interface ColonyFormModalProps {
  onHide: () => void;
  onSaved: (colony: Colony) => void;
  /** Edits this colony */
  colony?: Colony | null;
  /** New colony: the hive and the compartment it goes in */
  hive?: Hive;
  compartment?: 1 | 2;
}

const ORIGINS: { value: NewColonyValues['origin']; label: string }[] = [
  { value: 'swarm_caught', label: 'Essaim récolté' },
  { value: 'package', label: 'Essaim nu acheté' },
  { value: 'unknown', label: 'Origine inconnue' },
];

/**
 * Put a colony in a hive (a caught swarm, a bought package), or edit one.
 * Divisions and swarms are recorded from the colony they come from.
 */
export default function ColonyFormModal({ onHide, onSaved, colony = null, hive, compartment = 1 }: ColonyFormModalProps) {
  const family = colony ? colony.hive.bar_family : hive!.bar_family;
  const count = countLabel(family);
  const capacity = hive ? compartmentCapacity(hive, compartment) : null;
  const [name, setName] = useState(colony?.name ?? '');
  const [origin, setOrigin] = useState<NewColonyValues['origin']>('swarm_caught');
  const [bars, setBars] = useState(colony?.bars != null ? String(colony.bars) : '');
  const [startedOn, setStartedOn] = useState(today());
  const [comments, setComments] = useState(colony?.comments ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values = { name: name.trim(), bars: count ? countOf(bars) : null, comments: comments.trim() };
    try {
      const saved = colony
        ? await updateColony(colony.id, values)
        : await createColony({ ...values, hive: hive!.id, compartment, origin, started_on: startedOn });
      onSaved(saved);
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
      icon={<i className="bi bi-bug hive-icon" aria-hidden="true" />}
      title={colony ? 'Modifier la colonie' : 'Installer une colonie'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          {colony ? 'Enregistrer' : 'Installer'}
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {hive && (
        <p className="fw-semibold mb-3">
          {hiveLabel(hive)}{hive.divider_bar ? ` · compartiment ${compartment}` : ''}
        </p>
      )}

      {!colony && (
        <Form.Group className="mb-3" controlId="colony-origin">
          <Form.Label className="d-flex align-items-center">
            Origine
            <HelpTip id="colony-origin-help" doc="apiaries#colonies" title="Origine d'une colonie">
              Une division et ce qui reste après un essaimage s'enregistrent depuis la fiche de la
              colonie d'origine, qui garde ainsi sa descendance.
            </HelpTip>
          </Form.Label>
          <Form.Select value={origin} onChange={(event) => setOrigin(event.target.value as NewColonyValues['origin'])} disabled={saving}>
            {ORIGINS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Form.Select>
        </Form.Group>
      )}

      <Form.Group className="mb-3" controlId="colony-name">
        <Form.Label>Nom</Form.Label>
        <Form.Control type="text" value={name} maxLength={120} disabled={saving}
          onChange={(event) => setName(event.target.value)} />
      </Form.Group>

      {count && (
        <Form.Group className="mb-3" controlId="colony-bars">
          <Form.Label>{count}{capacity !== null ? ` (${capacity} au plus)` : ''}</Form.Label>
          <Form.Control type="number" inputMode="numeric" min={0} max={capacity ?? undefined} value={bars}
            disabled={saving} onChange={(event) => setBars(event.target.value)} />
        </Form.Group>
      )}

      {!colony && (
        <Form.Group className="mb-3" controlId="colony-started">
          <Form.Label>Installée le</Form.Label>
          <Form.Control type="date" value={startedOn} max={today()} required disabled={saving}
            onChange={(event) => setStartedOn(event.target.value)} />
        </Form.Group>
      )}

      <Form.Group className="mb-0" controlId="colony-comments">
        <Form.Label>Commentaire</Form.Label>
        <Form.Control as="textarea" rows={3} value={comments} disabled={saving}
          onChange={(event) => setComments(event.target.value)} />
      </Form.Group>
    </AppModal>
  );
}
