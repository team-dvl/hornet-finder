import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { HelpTip } from '../common';
import { AppModal, Switch } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { colonyLabel } from '../../utils/coloniesApi';
import { fetchHives, hiveErrorOf, hiveLabel, type BarFamily, type PersonSummary } from '../../utils/hivesApi';
import {
  KIND_LABELS, blankInspection, createVisit, fetchVisitableApiaries, toLocalInput, updateVisit,
  type Inspection, type Visit, type VisitKind,
} from '../../utils/visitsApi';
import InspectionEditor from './InspectionEditor';
import ParticipantsPicker from './ParticipantsPicker';

interface VisitFormModalProps {
  onHide: () => void;
  onSaved: (visit: Visit) => void;
  /** Edits this visit */
  visit?: Visit | null;
  /** New visit: the apiary it takes place in */
  apiaryId?: number | null;
}

/** A colony that may be inspected: the living ones of the apiary, and those the visit already holds. */
interface Candidate {
  key: string;
  hive: string;
  colony: string | null;
  label: string;
  family: BarFamily;
  bars: number | null;
}

const keyOf = (hive: string | null, colony: string | null) => colony ?? `hive:${hive}`;

/**
 * Record a visit, or edit one: when, who came, what was done, and for each
 * colony looked at what was seen. The count of bars is prefilled with the
 * colony's (that of its latest visit).
 */
export default function VisitFormModal({ onHide, onSaved, visit = null, apiaryId = null }: VisitFormModalProps) {
  const auth = useAuth();
  const { isAdmin, userGuid } = useUserPermissions();
  const [apiaries, setApiaries] = useState<{ id: number; label: string }[] | null>(null);
  const [apiary, setApiary] = useState<number | null>(visit?.apiary?.id ?? apiaryId);
  const [startedAt, setStartedAt] = useState(visit ? toLocalInput(visit.started_at) : toLocalInput(new Date().toISOString()));
  const [duration, setDuration] = useState(visit?.duration_minutes ? String(visit.duration_minutes) : '');
  const [title, setTitle] = useState(visit?.title ?? '');
  const [kinds, setKinds] = useState<VisitKind[]>(visit?.kinds ?? []);
  const [participants, setParticipants] = useState<PersonSummary[]>(visit?.participants
    ?? (userGuid ? [{ guid: userGuid, display_name: auth.user?.profile.name ?? 'Moi' }] : []));
  const [guests, setGuests] = useState(visit?.guest_names ?? '');
  const [report, setReport] = useState(visit?.report ?? '');
  // The inspections chosen, by colony (or hive, for a hive without a known colony)
  const [inspections, setInspections] = useState<Record<string, Inspection>>(() => Object.fromEntries(
    (visit?.inspections ?? []).map((inspection) => [keyOf(inspection.hive, inspection.colony), inspection]),
  ));
  const [loadedFor, setLoadedFor] = useState<{ apiary: number; list: Candidate[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visit) return;
    let cancelled = false;
    fetchVisitableApiaries(isAdmin)
      .then((found) => {
        if (cancelled) return;
        setApiaries(found);
        setApiary((current) => current ?? found[0]?.id ?? null);
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [visit, isAdmin]);

  useEffect(() => {
    if (!apiary) return;
    let cancelled = false;
    fetchHives({ apiary, status: 'active' })
      .then((hives) => {
        if (cancelled) return;
        const list = hives.flatMap((hive) => hive.colonies.map((colony) => ({
          key: colony.id, hive: hive.id, colony: colony.id, family: hive.bar_family, bars: colony.bars,
          label: `${colonyLabel(colony)} · ${hiveLabel(hive)}${hive.divider_bar ? ` (${colony.compartment})` : ''}`,
        })));
        setLoadedFor({ apiary, list });
      })
      .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    return () => { cancelled = true; };
  }, [apiary]);

  // The living colonies, then those of the visit that no longer live there
  const candidates = useMemo<Candidate[]>(() => {
    const living = loadedFor?.apiary === apiary ? loadedFor.list : [];
    const known = new Set(living.map((candidate) => candidate.key));
    const past = (visit?.inspections ?? [])
      .filter((inspection) => !known.has(keyOf(inspection.hive, inspection.colony)))
      .map((inspection) => ({
        key: keyOf(inspection.hive, inspection.colony), hive: inspection.hive ?? '', colony: inspection.colony,
        family: inspection.bar_family ?? '', bars: inspection.bars,
        label: [inspection.colony_label, inspection.hive_label].filter(Boolean).join(' · '),
      }));
    return [...living, ...past];
  }, [loadedFor, apiary, visit]);

  const toggleKind = (kind: VisitKind) => setKinds((current) => (current.includes(kind)
    ? current.filter((item) => item !== kind) : [...current, kind]));

  const include = (candidate: Candidate, on: boolean) => setInspections((current) => {
    const next = { ...current };
    if (on) next[candidate.key] = current[candidate.key] ?? blankInspection(candidate.hive, candidate.colony, candidate.bars);
    else delete next[candidate.key];
    return next;
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiary || !startedAt) return;
    setSaving(true);
    setError(null);
    const values = {
      started_at: new Date(startedAt).toISOString(),
      duration_minutes: duration ? Number(duration) : null,
      title: title.trim(),
      kinds,
      report: report.trim(),
      guest_names: guests.trim(),
      participants: participants.map((person) => person.guid),
      inspections: Object.values(inspections),
    };
    try {
      onSaved(visit ? await updateVisit(visit.id, values) : await createVisit({ ...values, apiary }));
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  const loadingColonies = Boolean(apiary) && loadedFor?.apiary !== apiary && !error;

  return (
    <AppModal
      show
      onHide={onHide}
      locked
      icon={<i className="bi bi-journal-text hive-icon" aria-hidden="true" />}
      title={visit ? 'Modifier la visite' : 'Nouvelle visite'}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant="success" disabled={saving || !apiary}>
          {saving ? <Spinner animation="border" size="sm" className="me-2" /> : <i className="bi bi-check-lg me-2" aria-hidden="true" />}
          Enregistrer
        </Button>
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      {visit ? (
        <p className="fw-semibold mb-3">{visit.apiary ? visit.apiary.address || `Rucher #${visit.apiary.id}` : visit.apiary_label}</p>
      ) : (
        <Form.Group className="mb-3" controlId="visit-apiary">
          <Form.Label>Rucher</Form.Label>
          <Form.Select value={apiary ?? ''} disabled={saving || apiaries === null}
            onChange={(event) => { setApiary(Number(event.target.value) || null); setInspections({}); }}>
            {apiaries === null && <option value="">Chargement…</option>}
            {apiaryId && !apiaries?.some((option) => option.id === apiaryId) && <option value={apiaryId}>Rucher #{apiaryId}</option>}
            {apiaries?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Form.Select>
        </Form.Group>
      )}

      <div className="d-flex gap-2">
        <Form.Group className="mb-3 flex-grow-1" controlId="visit-started">
          <Form.Label>Le</Form.Label>
          <Form.Control type="datetime-local" value={startedAt} required disabled={saving}
            max={toLocalInput(new Date().toISOString())} onChange={(event) => setStartedAt(event.target.value)} />
        </Form.Group>
        <Form.Group className="mb-3 visit-duration-field flex-shrink-0" controlId="visit-duration">
          <Form.Label>Durée (min)</Form.Label>
          <Form.Control type="number" inputMode="numeric" min={1} value={duration} disabled={saving}
            onChange={(event) => setDuration(event.target.value)} />
        </Form.Group>
      </div>

      <Form.Group className="mb-3" controlId="visit-title">
        <Form.Label>Intitulé</Form.Label>
        <Form.Control type="text" value={title} maxLength={120} disabled={saving}
          onChange={(event) => setTitle(event.target.value)} />
      </Form.Group>

      <div className="mb-3">
        <div className="obs-label mb-1">Fait pendant la visite</div>
        <div className="visit-chips" role="group" aria-label="Fait pendant la visite">
          {(Object.entries(KIND_LABELS) as [VisitKind, string][]).map(([kind, label]) => (
            <Button key={kind} variant={kinds.includes(kind) ? 'secondary' : 'outline-secondary'}
              aria-pressed={kinds.includes(kind)} disabled={saving} onClick={() => toggleKind(kind)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="obs-label mb-1 d-flex align-items-center">
        Participants
        <HelpTip id="visit-participants-help" doc="apiaries#visits" title="Participants">
          Les membres de vos associations. Ils voient la visite et peuvent la compléter. Les personnes
          sans compte se nomment dans le champ suivant ; leur nom n'apparaît jamais dans le journal
          d'audit.
        </HelpTip>
      </div>
      <ParticipantsPicker value={participants} onChange={setParticipants} disabled={saving} />

      <Form.Group className="mb-3" controlId="visit-guests">
        <Form.Label>Autres participants</Form.Label>
        <Form.Control type="text" value={guests} maxLength={255} autoComplete="off" disabled={saving}
          onChange={(event) => setGuests(event.target.value)} />
      </Form.Group>

      <div className="obs-label mb-1">Colonies</div>
      {loadingColonies && <div className="mb-3"><Spinner animation="border" size="sm" /></div>}
      {!loadingColonies && candidates.length === 0 && <p className="text-muted small">Aucune colonie dans ce rucher.</p>}
      {candidates.map((candidate) => {
        const inspection = inspections[candidate.key];
        return (
          <div key={candidate.key} className="border rounded px-2 pt-1 mb-2">
            <Switch id={`visit-inspect-${candidate.key}`} label={candidate.label} checked={Boolean(inspection)}
              disabled={saving} onChange={(on) => include(candidate, on)} />
            {inspection && (
              <InspectionEditor
                idPrefix={`visit-inspection-${candidate.key}`}
                inspection={inspection}
                family={candidate.family}
                disabled={saving}
                onChange={(next) => setInspections((current) => ({ ...current, [candidate.key]: next }))}
              />
            )}
          </div>
        );
      })}

      <Form.Group className="mt-3 mb-0" controlId="visit-report">
        <Form.Label>Compte rendu</Form.Label>
        <Form.Control as="textarea" rows={4} value={report} disabled={saving}
          onChange={(event) => setReport(event.target.value)} />
      </Form.Group>
    </AppModal>
  );
}
