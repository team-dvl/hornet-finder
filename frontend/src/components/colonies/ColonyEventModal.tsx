import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, ButtonGroup, Form, Spinner } from 'react-bootstrap';
import { HelpTip } from '../common';
import { AppModal, Switch } from '../ui';
import {
  colonyLabel, compartmentCapacity, countLabel, countOf, endColony, fetchColonies, freeCompartments, recordLaying,
  splitColony, swarmColony, transferColony, type Colony, type ColonyEnd,
} from '../../utils/coloniesApi';
import {
  apiaryLabel, fetchHives, hiveErrorOf, hiveLabel, today, type Hive,
} from '../../utils/hivesApi';

export type ColonyEventMode = 'split' | 'swarm' | 'transfer' | 'end' | 'laying';

const TITLES: Record<ColonyEventMode, string> = {
  split: 'Diviser la colonie',
  swarm: 'Essaimage',
  transfer: 'Transvaser la colonie',
  end: 'Fin de la colonie',
  laying: 'Ponte constatée',
};

const SUBMITS: Record<ColonyEventMode, { label: string; icon: string; variant: string }> = {
  split: { label: 'Diviser', icon: 'diagram-2', variant: 'primary' },
  swarm: { label: 'Enregistrer', icon: 'check-lg', variant: 'primary' },
  transfer: { label: 'Transvaser', icon: 'arrow-left-right', variant: 'primary' },
  end: { label: 'Enregistrer', icon: 'check-lg', variant: 'danger' },
  laying: { label: 'Enregistrer', icon: 'check-lg', variant: 'success' },
};

const CAUSES: { value: Exclude<ColonyEnd, 'swarmed'>; label: string }[] = [
  { value: 'died', label: 'Morte' },
  { value: 'merged', label: 'Réunie' },
  { value: 'absconded', label: 'Désertée' },
  { value: 'unknown', label: 'Inconnue' },
];

const QUEEN_SIDES: { value: 'parent' | 'daughter' | 'unknown'; label: string }[] = [
  { value: 'parent', label: 'Elle reste dans la colonie' },
  { value: 'daughter', label: 'Elle part avec la division' },
  { value: 'unknown', label: 'Je ne sais pas' },
];

/** A place a colony may go: a hive in service the user tends, and a free compartment of it. */
interface Place {
  key: string;
  hive: Hive;
  compartment: 1 | 2;
  label: string;
}

/**
 * Where the colony may go. In its own hive, the other compartment: for a
 * division, even without a divider yet (it is put for the occasion).
 */
function placesIn(hives: Hive[], colony: Colony, dividerMayBePut: boolean): Place[] {
  const places: Place[] = [];
  for (const hive of hives) {
    if (!hive.permissions?.move || hive.status !== 'active') continue;
    const same = hive.id === colony.hive.id;
    if (same && !hive.divider_bar && !dividerMayBePut) continue;
    const free = same && hive.max_colonies > 1
      ? [(3 - colony.compartment) as 1 | 2].filter((c) => !hive.colonies.some((other) => other.compartment === c))
      : freeCompartments(hive);
    for (const compartment of free) {
      const where = hive.apiary ? ` · ${apiaryLabel(hive.apiary)}` : '';
      const side = hive.max_colonies > 1 && (hive.divider_bar || same) ? ` · compartiment ${compartment}` : '';
      places.push({
        key: `${hive.id}:${compartment}`, hive, compartment,
        label: same ? `Même ruche, compartiment ${compartment}` : `${hiveLabel(hive)}${side}${where}`,
      });
    }
  }
  // The other compartment of its own hive first
  return places.sort((a, b) => Number(b.hive.id === colony.hive.id) - Number(a.hive.id === colony.hive.id));
}

interface ColonyEventModalProps {
  mode: ColonyEventMode;
  colony: Colony;
  onHide: () => void;
  /** With the colony to show next: the parent after a division, what stayed after a swarm */
  onDone: (colony: Colony) => void;
}

/**
 * The dated events of a colony: a division (to the other compartment of its
 * hive, behind a divider, or to another hive), a swarm (what stays is a new
 * colony, so is the swarm when caught), a transfer, its end, and the laying
 * of a new queen.
 */
export default function ColonyEventModal({ mode, colony, onHide, onDone }: ColonyEventModalProps) {
  const needsPlaces = mode === 'split' || mode === 'transfer' || mode === 'swarm';
  const [hives, setHives] = useState<Hive[] | null>(null);
  const [colonies, setColonies] = useState<Colony[] | null>(null);
  const [placeKey, setPlaceKey] = useState('');
  const [on, setOn] = useState(today());
  const [name, setName] = useState('');
  const [bars, setBars] = useState('');
  const [divider, setDivider] = useState('');
  const [queen, setQueen] = useState<'parent' | 'daughter' | 'unknown'>('parent');
  const [caught, setCaught] = useState(false);
  const [cause, setCause] = useState<Exclude<ColonyEnd, 'swarmed'>>('died');
  const [mergedInto, setMergedInto] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (needsPlaces) {
      fetchHives({ status: 'active' })
        .then((found) => { if (!cancelled) setHives(found); })
        .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    }
    if (mode === 'end') {
      fetchColonies({ status: 'active' })
        .then((found) => { if (!cancelled) setColonies(found.filter((other) => other.id !== colony.id && other.permissions?.edit)); })
        .catch((fetchError) => { if (!cancelled) setError(hiveErrorOf(fetchError)); });
    }
    return () => { cancelled = true; };
  }, [needsPlaces, mode, colony.id]);

  const places = useMemo(() => {
    if (!hives) return [];
    const all = placesIn(hives, colony, mode === 'split');
    // A transfer may go anywhere free; a caught swarm never into its own compartment
    return mode === 'swarm' ? all.filter((place) => place.hive.id !== colony.hive.id || place.compartment !== colony.compartment) : all;
  }, [hives, colony, mode]);
  const place = places.find((item) => item.key === placeKey) ?? places[0];
  const ownHive = hives?.find((hive) => hive.id === colony.hive.id);
  const needsDivider = mode === 'split' && place && place.hive.id === colony.hive.id && !place.hive.divider_bar;
  const count = place ? countLabel(place.hive.bar_family) : countLabel(colony.hive.bar_family);
  const capacity = place
    ? compartmentCapacity(place.hive, place.compartment, needsDivider ? Number(divider) || null : place.hive.divider_bar)
    : null;
  // Within the same family of bars, a transfer keeps the count
  const keepsBars = mode === 'transfer' && place && place.hive.bar_family === colony.hive.bar_family;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let next: Colony;
      if (mode === 'split') {
        if (!place) return;
        next = await splitColony(colony.id, {
          on, name: name.trim(), bars: count ? countOf(bars) : null, queen,
          ...(place.hive.id !== colony.hive.id ? { hive: place.hive.id } : {}),
          compartment: place.compartment,
          ...(needsDivider && divider ? { divider_bar: Number(divider) } : {}),
        });
      } else if (mode === 'swarm') {
        next = await swarmColony(colony.id, on, caught && place ? {
          hive: place.hive.id, compartment: place.compartment, name: name.trim(),
          bars: countLabel(place.hive.bar_family) ? countOf(bars) : null,
        } : null);
      } else if (mode === 'transfer') {
        if (!place) return;
        next = await transferColony(colony.id, {
          on, hive: place.hive.id, compartment: place.compartment,
          ...(keepsBars && bars === '' ? {} : { bars: count ? countOf(bars) : null }),
        });
      } else if (mode === 'end') {
        next = await endColony(colony.id, { on, cause, ...(cause === 'merged' ? { merged_into: mergedInto } : {}) });
      } else {
        next = await recordLaying(colony.id, on);
      }
      onDone(next);
    } catch (submitError) {
      setError(hiveErrorOf(submitError));
      setSaving(false);
    }
  };

  const submit = SUBMITS[mode];
  const waitingPlaces = needsPlaces && hives === null && !error;
  const noPlace = needsPlaces && hives !== null && places.length === 0 && (mode !== 'swarm' || caught);
  const disabled = saving || waitingPlaces || noPlace
    || (mode === 'split' && needsDivider && !divider)
    || (mode === 'end' && cause === 'merged' && !mergedInto);

  const placeSelect = (label: string) => (
    <Form.Group className="mb-3" controlId="colony-event-place">
      <Form.Label>{label}</Form.Label>
      {waitingPlaces && <div><Spinner animation="border" size="sm" /></div>}
      {noPlace && <p className="text-muted mb-0">Aucune ruche en service n'a de place libre.</p>}
      {places.length > 0 && (
        <Form.Select value={place?.key ?? ''} onChange={(event) => setPlaceKey(event.target.value)} disabled={saving}>
          {places.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </Form.Select>
      )}
    </Form.Group>
  );

  const countField = (label: string) => count && (
    <Form.Group className="mb-3" controlId="colony-event-bars">
      <Form.Label>{label}{capacity !== null ? ` (${capacity} au plus)` : ''}</Form.Label>
      <Form.Control type="number" inputMode="numeric" min={0} max={capacity ?? undefined} value={bars}
        placeholder={keepsBars && colony.bars !== null ? String(colony.bars) : undefined}
        disabled={saving} onChange={(event) => setBars(event.target.value)} />
    </Form.Group>
  );

  return (
    <AppModal
      show
      onHide={onHide}
      locked={mode === 'split' || mode === 'swarm'}
      icon={<i className="bi bi-bug hive-icon" aria-hidden="true" />}
      title={TITLES[mode]}
      onSubmit={handleSubmit}
      footer={(
        <Button type="submit" variant={submit.variant} disabled={disabled}>
          {saving
            ? <Spinner animation="border" size="sm" className="me-2" />
            : <i className={`bi bi-${submit.icon} me-2`} aria-hidden="true" />}
          {submit.label}
        </Button>
      )}
    >
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <p className="fw-semibold mb-3">{colonyLabel(colony)} · {hiveLabel(colony.hive)}</p>

      {mode === 'split' && (
        <>
          {placeSelect('La division va dans')}
          {needsDivider && ownHive?.max_bars && (
            <Form.Group className="mb-3" controlId="colony-split-divider">
              <Form.Label className="d-flex align-items-center">
                Cloison à la barrette
                <HelpTip id="split-divider-help" doc="apiaries#colonies" title="Cloison">
                  La cloison prend la place d'une barrette : la colonie actuelle garde les barrettes
                  en deçà, la division prend celles au-delà.
                </HelpTip>
              </Form.Label>
              <Form.Control type="number" inputMode="numeric" min={2} max={ownHive.max_bars - 1} value={divider}
                required disabled={saving} onChange={(event) => setDivider(event.target.value)} />
            </Form.Group>
          )}
          {countField(count === 'Barrettes' ? 'Barrettes prises à la colonie' : (count ?? ''))}
          <Form.Group className="mb-3">
            <Form.Label className="d-flex align-items-center">
              La reine
              <HelpTip id="split-queen-help" doc="apiaries#colonies" title="La reine">
                La partie qui n'a pas la reine en élève une nouvelle : c'est elle qui connaît la
                rupture de ponte.
              </HelpTip>
            </Form.Label>
            {QUEEN_SIDES.map((option) => (
              <Form.Check
                key={option.value}
                type="radio"
                name="colony-split-queen"
                id={`colony-split-queen-${option.value}`}
                className="py-2"
                label={option.label}
                checked={queen === option.value}
                disabled={saving}
                onChange={() => setQueen(option.value)}
              />
            ))}
          </Form.Group>
          <Form.Group className="mb-3" controlId="colony-split-name">
            <Form.Label>Nom de la division</Form.Label>
            <Form.Control type="text" value={name} maxLength={120} disabled={saving}
              onChange={(event) => setName(event.target.value)} />
          </Form.Group>
        </>
      )}

      {mode === 'swarm' && (
        <>
          <div className="mb-3 d-flex align-items-center">
            <div className="flex-grow-1">
              <Switch id="colony-swarm-caught" label="Essaim récolté" checked={caught} disabled={saving}
                onChange={setCaught} />
            </div>
            <HelpTip id="swarm-help" doc="apiaries#colonies" title="Essaimage">
              La colonie part avec sa reine. Ce qui reste dans la ruche devient une nouvelle colonie,
              qui élève une nouvelle reine ; l'essaim récolté en est une autre. Toutes deux
              descendent de la colonie qui a essaimé.
            </HelpTip>
          </div>
          {caught && (
            <>
              {placeSelect("L'essaim est mis dans")}
              {countField(count ?? '')}
              <Form.Group className="mb-3" controlId="colony-swarm-name">
                <Form.Label>Nom de l'essaim</Form.Label>
                <Form.Control type="text" value={name} maxLength={120} disabled={saving}
                  onChange={(event) => setName(event.target.value)} />
              </Form.Group>
            </>
          )}
        </>
      )}

      {mode === 'transfer' && (
        <>
          {placeSelect('Vers')}
          {countField(count ?? '')}
        </>
      )}

      {mode === 'end' && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Cause</Form.Label>
            <ButtonGroup className="d-flex flex-wrap" aria-label="Cause">
              {CAUSES.map((option) => (
                <Button key={option.value} variant={cause === option.value ? 'secondary' : 'outline-secondary'}
                  onClick={() => setCause(option.value)} aria-pressed={cause === option.value} disabled={saving}>
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
          </Form.Group>
          {cause === 'merged' && (
            <Form.Group className="mb-3" controlId="colony-end-merged">
              <Form.Label>Réunie à</Form.Label>
              {colonies === null && !error && <div><Spinner animation="border" size="sm" /></div>}
              {colonies?.length === 0 && <p className="text-muted mb-0">Aucune autre colonie.</p>}
              {colonies && colonies.length > 0 && (
                <Form.Select value={mergedInto} onChange={(event) => setMergedInto(event.target.value)} required disabled={saving}>
                  <option value="">Choisir…</option>
                  {colonies.map((other) => (
                    <option key={other.id} value={other.id}>{colonyLabel(other)} · {hiveLabel(other.hive)}</option>
                  ))}
                </Form.Select>
              )}
            </Form.Group>
          )}
        </>
      )}

      <Form.Group className="mb-0" controlId="colony-event-on">
        <Form.Label>Le</Form.Label>
        <Form.Control type="date" value={on} max={today()} min={colony.requeening_since && mode === 'laying' ? colony.requeening_since : colony.started_on}
          required disabled={saving} onChange={(event) => setOn(event.target.value)} />
      </Form.Group>
    </AppModal>
  );
}
