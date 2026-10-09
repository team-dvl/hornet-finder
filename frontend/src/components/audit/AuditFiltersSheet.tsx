import { useEffect, useState } from 'react';
import { Button, Form, ListGroup, Spinner } from 'react-bootstrap';
import { searchAuditActors, type AuditActor } from '../../utils/auditApi';
import { ACTION_LABELS, DOMAINS, domainOf } from '../../utils/auditLabels';
import { PERIODS, SOURCES, periodOf } from '../../utils/auditFilters';
import { BottomSheet } from '../ui';
import AuditDomainIcon from './AuditDomainIcon';

interface AuditFiltersSheetProps {
  show: boolean;
  onHide: () => void;
  params: URLSearchParams;
  /** Sets (or, with `null`, removes) address parameters; the list follows at once */
  onChange: (changes: Record<string, string | null>) => void;
}

/**
 * Filters of the audit trail, applied as they are picked (as the statistics
 * do): the list behind the sheet follows, the close button is the way out.
 */
export default function AuditFiltersSheet({ show, onHide, params, onChange }: AuditFiltersSheetProps) {
  const period = periodOf(params);
  const domains = (params.get('domain') ?? '').split(',').filter(Boolean);
  const actions = Object.keys(ACTION_LABELS).filter((code) => !domains.length || domains.includes(domainOf(code)));

  const [text, setText] = useState(params.get('q') ?? '');
  const [who, setWho] = useState('');
  const [found, setFound] = useState<AuditActor[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // The text filter follows the typing, a moment after it
  useEffect(() => {
    if (text === (params.get('q') ?? '')) return undefined;
    const timer = window.setTimeout(() => onChange({ q: text.trim() || null }), 400);
    return () => window.clearTimeout(timer);
  }, [text, params, onChange]);

  const query = who.trim();
  // Two letters at least: shorter, the last answer is hidden
  const shown = query.length >= 2 ? found : null;

  useEffect(() => {
    if (query.length < 2) return undefined;
    let current = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchAuditActors(query)
        .then((actors) => { if (current) setFound(actors); })
        .catch((error: Error) => { if (current) setSearchError(error.message); })
        .finally(() => { if (current) setSearching(false); });
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const toggleDomain = (domain: string) => {
    const next = domains.includes(domain) ? domains.filter((d) => d !== domain) : [...domains, domain];
    const action = params.get('action');
    onChange({
      domain: next.length ? next.join(',') : null,
      // An action outside the domains picked would hide everything
      action: action && next.length && !next.includes(domainOf(action)) ? null : action,
    });
  };

  const pickActor = (actor: AuditActor) => {
    onChange({ actor: actor.guid, actor_name: actor.name });
    setWho('');
    setFound(null);
  };

  return (
    <BottomSheet show={show} onHide={onHide} title="Filtres">
      <Form.Label className="fw-semibold mb-2">Période</Form.Label>
      <div className="stat-chip-grid" role="radiogroup" aria-label="Période">
        {PERIODS.map((option) => (
          <Button
            key={option.value}
            variant={period === option.value ? 'primary' : 'outline-primary'}
            className="rounded-pill"
            role="radio"
            aria-checked={period === option.value}
            onClick={() => onChange({ period: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="stat-field-row mt-2">
          <Form.Group controlId="audit-from" className="flex-grow-1">
            <Form.Label className="small text-muted mb-1">Du</Form.Label>
            <Form.Control type="date" value={params.get('from') ?? ''} onChange={(e) => onChange({ from: e.target.value || null })} />
          </Form.Group>
          <Form.Group controlId="audit-to" className="flex-grow-1">
            <Form.Label className="small text-muted mb-1">Au</Form.Label>
            <Form.Control type="date" value={params.get('to') ?? ''} onChange={(e) => onChange({ to: e.target.value || null })} />
          </Form.Group>
        </div>
      )}

      <Form.Label className="fw-semibold mt-3 mb-2 d-block">Domaines</Form.Label>
      <div className="d-flex flex-wrap gap-2" role="group" aria-label="Domaines">
        {Object.entries(DOMAINS).map(([domain, { label }]) => {
          const on = domains.includes(domain);
          return (
            <Button
              key={domain}
              variant={on ? 'primary' : 'outline-primary'}
              className="rounded-pill audit-chip"
              aria-pressed={on}
              onClick={() => toggleDomain(domain)}
            >
              <AuditDomainIcon domain={domain} /> {label}
            </Button>
          );
        })}
      </div>

      <Form.Group controlId="audit-action" className="mt-3">
        <Form.Label className="fw-semibold">Action</Form.Label>
        <Form.Select value={params.get('action') ?? ''} onChange={(e) => onChange({ action: e.target.value || null })}>
          <option value="">Toutes les actions</option>
          {actions.map((code) => <option key={code} value={code}>{ACTION_LABELS[code]}</option>)}
        </Form.Select>
      </Form.Group>

      <Form.Group controlId="audit-actor" className="mt-3">
        <Form.Label className="fw-semibold">Personne</Form.Label>
        {params.get('actor') && (
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className="text-truncate">{params.get('actor_name') || 'Une personne'}</span>
            <Button variant="link" className="p-0 ms-auto flex-shrink-0" onClick={() => onChange({ actor: null, actor_name: null })}>
              Retirer
            </Button>
          </div>
        )}
        <Form.Control
          type="search"
          placeholder="Nom ou email"
          value={who}
          autoComplete="off"
          onChange={(e) => setWho(e.target.value)}
        />
        {searching && <Spinner animation="border" size="sm" className="mt-2" />}
        {searchError && <div className="small text-danger mt-1">{searchError}</div>}
        {shown && !searching && (
          <ListGroup className="mt-1">
            {shown.length === 0 && <ListGroup.Item className="small text-muted">Personne ne correspond.</ListGroup.Item>}
            {shown.map((actor) => (
              <ListGroup.Item key={actor.guid} action onClick={() => pickActor(actor)} className="audit-pick">
                {actor.name}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Form.Group>

      <Form.Label className="fw-semibold mt-3 mb-2 d-block">Source</Form.Label>
      <div className="stat-chip-grid" role="radiogroup" aria-label="Source">
        {SOURCES.map((option) => {
          const on = (params.get('source') ?? '') === option.value;
          return (
            <Button
              key={option.value || 'all'}
              variant={on ? 'primary' : 'outline-primary'}
              role="radio"
              aria-checked={on}
              className="rounded-pill"
              onClick={() => onChange({ source: option.value || null })}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <Form.Group controlId="audit-text" className="mt-3 mb-2">
        <Form.Label className="fw-semibold">Texte dans les détails</Form.Label>
        <Form.Control
          type="search"
          placeholder="Adresse, commentaire, code…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Form.Group>
    </BottomSheet>
  );
}
