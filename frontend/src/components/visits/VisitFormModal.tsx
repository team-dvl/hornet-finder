import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useAuth } from 'react-oidc-context';
import { HelpTip, MarkdownEditor } from '../common';
import { AppModal, IconButton, Switch } from '../ui';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { colonyLabel } from '../../utils/coloniesApi';
import { fetchHives, hiveErrorOf, hiveLabel, type BarFamily, type PersonSummary } from '../../utils/hivesApi';
import {
  KIND_LABELS, WEATHER_LABELS, blankInspection, createVisit, fetchVisitableApiaries, fetchWeather, toLocalInput,
  updateVisit, type Inspection, type Visit, type VisitKind, type VisitWeather, type WeatherSummary,
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
  const [weather, setWeather] = useState<VisitWeather>(() => ({
    weather_temperature: visit?.weather_temperature ?? null,
    weather_precipitation: visit?.weather_precipitation ?? null,
    weather_wind: visit?.weather_wind ?? null,
    weather_cloud_cover: visit?.weather_cloud_cover ?? null,
    weather_summary: visit?.weather_summary ?? '',
    weather_source: visit?.weather_source ?? '',
  }));
  const [fetchingWeather, setFetchingWeather] = useState(false);
  // A value typed by hand: the weather no longer reads as Open-Meteo's
  const setWeatherField = <K extends keyof VisitWeather>(name: K, value: VisitWeather[K]) =>
    setWeather((current) => ({ ...current, [name]: value, weather_source: '' }));
  const fillWeather = async () => {
    if (!apiary || !startedAt) return;
    setFetchingWeather(true);
    setError(null);
    try {
      const found = await fetchWeather(apiary, new Date(startedAt).toISOString());
      const text = (value: number | null) => (value === null ? null : String(value));
      setWeather({
        weather_temperature: text(found.temperature), weather_precipitation: text(found.precipitation),
        weather_wind: text(found.wind), weather_cloud_cover: found.cloud_cover, weather_summary: found.summary,
        weather_source: 'open-meteo',
      });
    } catch (weatherError) {
      setError(hiveErrorOf(weatherError));
    } finally {
      setFetchingWeather(false);
    }
  };
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
      ...weather,
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

      <div className="d-flex align-items-center mb-1">
        <span className="obs-label flex-grow-1 d-flex align-items-center">
          Météo
          <HelpTip id="visit-weather-help" doc="apiaries#visits" title="Météo">
            Le bouton demande à Open-Meteo (données ouvertes) la météo de l'heure de la visite autour du
            rucher : des valeurs de modèle à l'heure près, sur une grille de quelques kilomètres (plus
            grossière pour les dates de plus de 80 jours), pas une mesure sur place. Seule une
            position arrondie au kilomètre est envoyée, par le serveur. Corrigez-les librement.
          </HelpTip>
        </span>
        <IconButton variant="outline-secondary" icon="cloud-download" label="Open-Meteo"
          disabled={saving || fetchingWeather || !apiary} onClick={() => void fillWeather()} />
      </div>
      <div className="d-flex gap-2">
        <Form.Group className="mb-2 flex-fill" controlId="visit-temperature">
          <Form.Label className="obs-label mb-1">Température (°C)</Form.Label>
          <Form.Control type="number" inputMode="decimal" step="0.1" value={weather.weather_temperature ?? ''}
            disabled={saving} onChange={(event) => setWeatherField('weather_temperature', event.target.value || null)} />
        </Form.Group>
        <Form.Group className="mb-2 flex-fill" controlId="visit-wind">
          <Form.Label className="obs-label mb-1">Vent (km/h)</Form.Label>
          <Form.Control type="number" inputMode="decimal" min={0} step="0.1" value={weather.weather_wind ?? ''}
            disabled={saving} onChange={(event) => setWeatherField('weather_wind', event.target.value || null)} />
        </Form.Group>
      </div>
      <div className="d-flex gap-2">
        <Form.Group className="mb-2 flex-fill" controlId="visit-clouds">
          <Form.Label className="obs-label mb-1">Nuages (%)</Form.Label>
          <Form.Control type="number" inputMode="numeric" min={0} max={100} value={weather.weather_cloud_cover ?? ''}
            disabled={saving}
            onChange={(event) => setWeatherField('weather_cloud_cover', event.target.value === '' ? null : Number(event.target.value))} />
        </Form.Group>
        <Form.Group className="mb-2 flex-fill" controlId="visit-rain">
          <Form.Label className="obs-label mb-1">Pluie (mm)</Form.Label>
          <Form.Control type="number" inputMode="decimal" min={0} step="0.1" value={weather.weather_precipitation ?? ''}
            disabled={saving} onChange={(event) => setWeatherField('weather_precipitation', event.target.value || null)} />
        </Form.Group>
      </div>
      <Form.Group className="mb-3" controlId="visit-weather">
        <Form.Label className="obs-label mb-1">Temps</Form.Label>
        <Form.Select value={weather.weather_summary} disabled={saving}
          onChange={(event) => setWeatherField('weather_summary', event.target.value as WeatherSummary)}>
          <option value="">—</option>
          {(Object.entries(WEATHER_LABELS) as [WeatherSummary, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Form.Select>
      </Form.Group>

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

      <div className="mt-3">
        <MarkdownEditor id="visit-report" rows={5} value={report} onChange={setReport} disabled={saving}
          label={(
            <span className="d-inline-flex align-items-center">
              Compte rendu
              <HelpTip id="visit-markdown-help" doc="apiaries#visits" title="Mise en forme">
                Le texte accepte le Markdown : **gras**, _italique_, ### titre, - liste, 1. liste
                numérotée, [lien](https://…). La barre d'outils l'écrit pour vous ; « Aperçu » montre
                le rendu.
              </HelpTip>
            </span>
          )} />
      </div>
    </AppModal>
  );
}
