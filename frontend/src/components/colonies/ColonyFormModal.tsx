import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, ButtonGroup, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal } from '../ui';
import FollowUpProposals from '../visits/FollowUpProposals';
import {
  colonyLabel, compartmentCapacity, countLabel, countOf, createColony, daysBetween, fetchColonies, transferColony,
  updateColony, type Colony, type NewColonyValues,
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

type Source = 'existing' | 'new';

/**
 * Put a colony in a hive, or edit one. The colony comes from another hive or
 * from a nucleus, where it waited a few days (a transfer: it keeps its
 * identity), or it is new: a caught swarm, a bought package. Divisions and
 * swarms are recorded from the colony they come from.
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
  // New colony: the living colonies it may come from, those in a nucleus first
  const creating = !colony;
  const [candidates, setCandidates] = useState<Colony[] | null>(null);
  const [chosenSource, setChosenSource] = useState<Source | null>(null);
  const [movedId, setMovedId] = useState('');
  // Saved, with follow-up visits to propose before closing
  const [result, setResult] = useState<Colony | null>(null);

  useEffect(() => {
    if (!creating || !hive) return;
    let cancelled = false;
    fetchColonies({ status: 'active' })
      .then((found) => {
        if (cancelled) return;
        setCandidates(found
          .filter((other) => other.permissions?.edit && !(other.hive.id === hive.id && other.compartment === compartment))
          .sort((a, b) => Number(b.hive.portable) - Number(a.hive.portable) || colonyLabel(a).localeCompare(colonyLabel(b))));
      })
      .catch(() => { if (!cancelled) setCandidates([]); });
    return () => { cancelled = true; };
  }, [creating, hive, compartment]);

  // Coming from a nucleus is the usual way; a new colony otherwise
  const source: Source = chosenSource ?? (candidates?.some((other) => other.hive.portable) ? 'existing' : 'new');
  const moved = useMemo(
    () => candidates?.find((other) => other.id === movedId) ?? candidates?.[0],
    [candidates, movedId],
  );
  // Within the same family of bars, the count follows the colony
  const keepsBars = Boolean(moved && hive && moved.hive.bar_family === hive.bar_family);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values = { name: name.trim(), bars: count ? countOf(bars) : null, comments: comments.trim() };
    try {
      const saved = colony
        ? await updateColony(colony.id, values)
        : source === 'existing' && moved
          ? await transferColony(moved.id, {
            on: startedOn, hive: hive!.id, compartment,
            ...(keepsBars && bars === '' ? {} : { bars: values.bars }),
          })
          : await createColony({ ...values, hive: hive!.id, compartment, origin, started_on: startedOn });
      if (saved.proposals?.length) setResult(saved);
      else onSaved(saved);
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  if (result?.proposals?.length) {
    return <FollowUpProposals proposals={result.proposals} onDone={() => onSaved(result)} />;
  }

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon={<i className="bi bi-bug hive-icon" aria-hidden="true" />}
      title={colony ? 'Modifier la colonie' : 'Installer une colonie'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving || (creating && source === 'existing' && !moved)}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          {colony ? 'Enregistrer' : source === 'existing' ? 'Transvaser' : 'Installer'}
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {hive && (
        <p className="fw-semibold mb-3">
          {hiveLabel(hive)}{hive.divider_bar ? ` · compartiment ${compartment}` : ''}
        </p>
      )}

      {creating && (
        <ButtonGroup className="d-flex mb-3" aria-label="Provenance de la colonie">
          <Button variant={source === 'existing' ? 'secondary' : 'outline-secondary'} aria-pressed={source === 'existing'}
            onClick={() => setChosenSource('existing')} disabled={saving}>
            D'une autre ruche
          </Button>
          <Button variant={source === 'new' ? 'secondary' : 'outline-secondary'} aria-pressed={source === 'new'}
            onClick={() => setChosenSource('new')} disabled={saving}>
            Nouvelle colonie
          </Button>
        </ButtonGroup>
      )}

      {creating && source === 'existing' && (
        <Form.Group className="mb-3" controlId="colony-moved">
          <Form.Label className="d-flex align-items-center">
            Colonie
            <HelpTip id="colony-moved-help" doc="apiaries#colonies" title="Transvaser">
              La colonie quitte sa ruche ou son nucleus pour celle-ci : elle garde son nom, sa lignée et
              l'historique de ses ruches. Ses barrettes la suivent entre ruches de la même famille.
            </HelpTip>
          </Form.Label>
          {candidates === null && <div><Spinner animation="border" size="sm" /></div>}
          {candidates?.length === 0 && <p className="text-muted mb-0">Aucune autre colonie dont vous vous occupez.</p>}
          {candidates && candidates.length > 0 && (
            <Form.Select value={moved?.id ?? ''} onChange={(event) => setMovedId(event.target.value)} disabled={saving}>
              {candidates.map((other) => (
                <option key={other.id} value={other.id}>
                  {colonyLabel(other)} · {hiveLabel(other.hive)}
                  {other.hive.portable && other.in_hive_since ? ` (J+${daysBetween(other.in_hive_since, today())})` : ''}
                </option>
              ))}
            </Form.Select>
          )}
        </Form.Group>
      )}

      {creating && source === 'new' && (
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

      {(!creating || source === 'new') && (
        <Form.Group className="mb-3" controlId="colony-name">
          <Form.Label>Nom</Form.Label>
          <Form.Control type="text" value={name} maxLength={120} disabled={saving}
            onChange={(event) => setName(event.target.value)} />
        </Form.Group>
      )}

      {count && (
        <Form.Group className="mb-3" controlId="colony-bars">
          <Form.Label>{count}{capacity !== null ? ` (${capacity} au plus)` : ''}</Form.Label>
          <Form.Control type="number" inputMode="numeric" min={0} max={capacity ?? undefined} value={bars}
            placeholder={creating && source === 'existing' && keepsBars && moved?.bars != null ? String(moved.bars) : undefined}
            disabled={saving} onChange={(event) => setBars(event.target.value)} />
        </Form.Group>
      )}

      {creating && (
        <Form.Group className="mb-3" controlId="colony-started">
          <Form.Label>{source === 'existing' ? 'Transvasée le' : 'Installée le'}</Form.Label>
          <Form.Control type="date" value={startedOn} max={today()} required disabled={saving}
            min={source === 'existing' ? moved?.in_hive_since ?? undefined : undefined}
            onChange={(event) => setStartedOn(event.target.value)} />
        </Form.Group>
      )}

      {(!creating || source === 'new') && (
        <Form.Group className="mb-0" controlId="colony-comments">
          <Form.Label>Commentaire</Form.Label>
          <Form.Control as="textarea" rows={3} value={comments} disabled={saving}
            onChange={(event) => setComments(event.target.value)} />
        </Form.Group>
      )}
    </AppModal>
  );
}
