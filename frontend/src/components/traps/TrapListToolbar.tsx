import { useEffect, useState } from 'react';
import { Button, ButtonGroup, Form, InputGroup, Spinner } from 'react-bootstrap';
import type { ManagedTrapsQuery, TrapOrdering, TrapScope, TrapType } from '../../store/store';

const ORDERINGS: { value: TrapOrdering; label: string }[] = [
  { value: 'last_event_at', label: 'Relevé le plus ancien' },
  { value: '-last_event_at', label: 'Relevé le plus récent' },
  { value: 'distance', label: 'Le plus proche' },
  { value: '-hornet_catch_count', label: 'Le plus de captures' },
  { value: '-installed_at', label: 'Installé récemment' },
  { value: 'installed_at', label: 'Installé il y a longtemps' },
  { value: 'address', label: 'Adresse (A → Z)' },
  { value: '-id', label: 'Numéro décroissant' },
];

const SCOPES: { value: TrapScope; label: string; icon: string }[] = [
  { value: 'mine', label: 'Mes pièges', icon: 'bi-person-fill' },
  { value: 'delegated', label: 'Délégués', icon: 'bi-people-fill' },
  { value: 'all', label: 'Tous', icon: 'bi-globe' },
];

interface TrapListToolbarProps {
  query: ManagedTrapsQuery;
  onChange: (changes: Partial<ManagedTrapsQuery>) => void;
  /** Scopes offered to this user ('all' is for platform admins) */
  scopes: TrapScope[];
  /** Groups the user belongs to, for the group filter */
  groups: string[];
  trapTypes: TrapType[];
  count: number;
  loading: boolean;
  locating: boolean;
}

/** Scope, search, filters and sorting of the trap manager. */
export default function TrapListToolbar({
  query, onChange, scopes, groups, trapTypes, count, loading, locating,
}: TrapListToolbarProps) {
  // Typed text is sent once the user pauses, not on every key
  const [search, setSearch] = useState(query.q ?? '');
  useEffect(() => {
    if (search === (query.q ?? '')) return;
    const timer = window.setTimeout(() => onChange({ q: search || undefined }), 350);
    return () => window.clearTimeout(timer);
  }, [search, query.q, onChange]);

  const [showFilters, setShowFilters] = useState(
    Boolean(query.group || query.trap_type || query.has_tag || query.active !== 'true'),
  );
  const activeFilters = [query.group, query.trap_type, query.has_tag].filter(Boolean).length
    + (query.active !== 'true' ? 1 : 0);

  return (
    <div className="trap-list-toolbar mb-3">
      {scopes.length > 1 && (
        <ButtonGroup className="w-100 mb-2 trap-scope" aria-label="Pièges affichés">
          {scopes.map((scope) => {
            const info = SCOPES.find((s) => s.value === scope)!;
            return (
              <Button
                key={scope}
                variant={query.scope === scope ? 'secondary' : 'outline-secondary'}
                onClick={() => onChange({ scope, group: undefined })}
                aria-pressed={query.scope === scope}
              >
                <i className={`bi ${info.icon} me-1`} aria-hidden="true" />
                <span className="text-truncate">{info.label}</span>
              </Button>
            );
          })}
        </ButtonGroup>
      )}

      <InputGroup className="mb-2">
        <InputGroup.Text><i className="bi bi-search" aria-hidden="true" /></InputGroup.Text>
        <Form.Control
          type="search"
          placeholder="N°, adresse, QR Code, commentaire…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un piège"
        />
        <Button
          variant={showFilters ? 'secondary' : 'outline-secondary'}
          onClick={() => setShowFilters((shown) => !shown)}
          aria-expanded={showFilters}
          aria-label="Filtres"
        >
          <i className="bi bi-funnel" aria-hidden="true" />
          {activeFilters > 0 && <span className="ms-1">{activeFilters}</span>}
        </Button>
      </InputGroup>

      {showFilters && (
        <div className="row g-2 mb-2">
          <div className="col-12 col-sm-6 col-md-3">
            <Form.Select
                            value={query.active}
              onChange={(e) => onChange({ active: e.target.value as ManagedTrapsQuery['active'] })}
              aria-label="État"
            >
              <option value="true">En service</option>
              <option value="false">Remisés</option>
              <option value="all">Tous les états</option>
            </Form.Select>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <Form.Select
                            value={query.trap_type ?? ''}
              onChange={(e) => onChange({ trap_type: e.target.value || undefined })}
              aria-label="Type de piège"
            >
              <option value="">Tous les types</option>
              {trapTypes.map((type) => (
                <option key={type.slug} value={type.slug}>{type.name}</option>
              ))}
            </Form.Select>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <Form.Select
                            value={query.has_tag ?? ''}
              onChange={(e) => onChange({ has_tag: (e.target.value || undefined) as ManagedTrapsQuery['has_tag'] })}
              aria-label="QR Code"
            >
              <option value="">Avec ou sans QR Code</option>
              <option value="true">Avec QR Code</option>
              <option value="false">Sans QR Code</option>
            </Form.Select>
          </div>
          {query.scope !== 'mine' && groups.length > 0 && (
            <div className="col-12 col-sm-6 col-md-3">
              <Form.Select
                                value={query.group ?? ''}
                onChange={(e) => onChange({ group: e.target.value || undefined })}
                aria-label="Groupe"
              >
                <option value="">Tous les groupes</option>
                {groups.map((path) => (
                  <option key={path} value={path}>{path.replace(/^\//, '').replace(/\//g, ' / ')}</option>
                ))}
              </Form.Select>
            </div>
          )}
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="small text-muted">
          {loading ? <Spinner animation="border" size="sm" /> : `${count} piège${count > 1 ? 's' : ''}`}
        </span>
        <div className="d-flex align-items-center gap-2">
          {locating && <Spinner animation="border" size="sm" aria-label="Localisation…" />}
          <Form.Select
                        value={query.ordering}
            onChange={(e) => onChange({ ordering: e.target.value as TrapOrdering })}
            aria-label="Trier par"
            className="trap-sort"
          >
            {ORDERINGS.map((ordering) => (
              <option key={ordering.value} value={ordering.value}>{ordering.label}</option>
            ))}
          </Form.Select>
        </div>
      </div>
    </div>
  );
}
