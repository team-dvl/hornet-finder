import { useEffect, useState } from 'react';
import { Button, ButtonGroup, Form, InputGroup, Spinner } from 'react-bootstrap';
import type { ApiaryOrdering, ApiaryScope, ManagedApiariesQuery } from '../../store/store';
import { INFESTATION_LABELS } from './apiaryLevels';

const ORDERINGS: { value: ApiaryOrdering; label: string }[] = [
  { value: '-infestation_level', label: 'Le plus infesté' },
  { value: 'distance', label: 'Le plus proche' },
  { value: '-created_at', label: 'Créé récemment' },
  { value: 'created_at', label: 'Créé il y a longtemps' },
  { value: 'address', label: 'Adresse (A → Z)' },
  { value: '-id', label: 'Numéro décroissant' },
];

const SCOPES: { value: ApiaryScope; label: string; icon: string }[] = [
  { value: 'mine', label: 'Mes ruchers', icon: 'bi-person-fill' },
  { value: 'shared', label: 'Partagés', icon: 'bi-people-fill' },
  { value: 'all', label: 'Tous', icon: 'bi-globe' },
];

interface ApiaryListToolbarProps {
  query: ManagedApiariesQuery;
  onChange: (changes: Partial<ManagedApiariesQuery>) => void;
  /** Scopes offered to this user ('all' is for platform admins) */
  scopes: ApiaryScope[];
  /** Groups the user belongs to, for the group filter */
  groups: string[];
  count: number;
  loading: boolean;
  locating: boolean;
}

/** Scope, search, filters and sorting of the apiary manager. */
export default function ApiaryListToolbar({
  query, onChange, scopes, groups, count, loading, locating,
}: ApiaryListToolbarProps) {
  // Typed text is sent once the user pauses, not on every key
  const [search, setSearch] = useState(query.q ?? '');
  useEffect(() => {
    if (search === (query.q ?? '')) return;
    const timer = window.setTimeout(() => onChange({ q: search || undefined }), 350);
    return () => window.clearTimeout(timer);
  }, [search, query.q, onChange]);

  const [showFilters, setShowFilters] = useState(Boolean(query.group || query.infestation_level));
  const activeFilters = [query.group, query.infestation_level].filter(Boolean).length;
  const groupFilter = query.scope !== 'mine' && groups.length > 0;

  return (
    <div className="manager-list-toolbar mb-3">
      {scopes.length > 1 && (
        <ButtonGroup className="w-100 mb-2 manager-scope" aria-label="Ruchers affichés">
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
          placeholder="N°, adresse, n° AFSCA, commentaire…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un rucher"
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
              value={query.infestation_level ?? ''}
              onChange={(e) => onChange({
                infestation_level: (e.target.value || undefined) as ManagedApiariesQuery['infestation_level'],
              })}
              aria-label="Infestation"
            >
              <option value="">Toutes les infestations</option>
              {([1, 2, 3] as const).map((level) => (
                <option key={level} value={String(level)}>{INFESTATION_LABELS[level]}</option>
              ))}
            </Form.Select>
          </div>
          {groupFilter && (
            <div className="col-12 col-sm-6 col-md-3">
              <Form.Select
                value={query.group ?? ''}
                onChange={(e) => onChange({ group: e.target.value || undefined })}
                aria-label="Partagé avec"
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
          {loading ? <Spinner animation="border" size="sm" /> : `${count} rucher${count > 1 ? 's' : ''}`}
        </span>
        <div className="d-flex align-items-center gap-2">
          {locating && <Spinner animation="border" size="sm" aria-label="Localisation…" />}
          <Form.Select
            value={query.ordering}
            onChange={(e) => onChange({ ordering: e.target.value as ApiaryOrdering })}
            aria-label="Trier par"
            className="manager-sort"
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
