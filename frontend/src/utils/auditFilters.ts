import type { AuditFilters, AuditSource } from './auditApi';
import { refName } from './auditLabels';

/**
 * Filters of the audit page, kept in the address (`/admin/audit?ref=trap:12`)
 * so that a link opens a history and Back returns to the previous filters.
 */

export const PERIODS = [
  { value: '1d', label: '24 h', days: 1 },
  { value: '7d', label: '7 jours', days: 7 },
  { value: '30d', label: '30 jours', days: 30 },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Dates' },
] as const;

export type Period = (typeof PERIODS)[number]['value'];

/** A history opens on everything; the plain list on the last week */
export const DEFAULT_PERIOD: Period = '7d';

export const SOURCES: { value: AuditSource | ''; label: string }[] = [
  { value: '', label: 'Toutes' },
  { value: 'api', label: 'Application' },
  { value: 'system', label: 'Automatiques' },
  { value: 'backfill', label: 'Reconstituées' },
];

export function periodOf(params: URLSearchParams): Period {
  const value = params.get('period');
  if (PERIODS.some((p) => p.value === value)) return value as Period;
  // The history of an object, a person or a request is shown whole
  return params.get('ref') || params.get('actor') || params.get('request') ? 'all' : DEFAULT_PERIOD;
}

/** The API filters the address stands for. */
export function toFilters(params: URLSearchParams): AuditFilters {
  const period = PERIODS.find((p) => p.value === periodOf(params));
  const filters: AuditFilters = {
    actor: params.get('actor') ?? undefined,
    action: params.get('action') ?? undefined,
    domain: params.get('domain') ?? undefined,
    ref: params.get('ref') ?? undefined,
    source: (params.get('source') as AuditSource | null) ?? undefined,
    request: params.get('request') ?? undefined,
    q: params.get('q') ?? undefined,
  };
  if (period && 'days' in period) {
    filters.since = new Date(Date.now() - period.days * 24 * 3600 * 1000).toISOString();
  } else if (period?.value === 'custom') {
    filters.since = params.get('from') ?? undefined;
    filters.until = params.get('to') ?? undefined;
  }
  return filters;
}

export interface FilterChip {
  label: string;
  /** Address parameters removed with the chip */
  clears: string[];
}

/** The active filters, as removable chips. */
export function filterChips(params: URLSearchParams, actionLabel: (code: string) => string,
  domainLabel: (code: string) => string): FilterChip[] {
  const chips: FilterChip[] = [];
  const period = periodOf(params);
  if (period === 'custom') {
    const from = params.get('from');
    const to = params.get('to');
    const day = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-BE');
    chips.push({ label: [from && `du ${day(from)}`, to && `au ${day(to)}`].filter(Boolean).join(' ') || 'Dates',
      clears: ['period', 'from', 'to'] });
  } else if (period !== 'all') {
    chips.push({ label: PERIODS.find((p) => p.value === period)!.label, clears: ['period'] });
  }
  const ref = params.get('ref');
  if (ref) chips.push({ label: params.get('ref_name') || refName(ref), clears: ['ref', 'ref_name'] });
  const actor = params.get('actor');
  if (actor) chips.push({ label: params.get('actor_name') || 'Une personne', clears: ['actor', 'actor_name'] });
  const request = params.get('request');
  if (request) chips.push({ label: 'Même requête', clears: ['request'] });
  for (const domain of (params.get('domain') ?? '').split(',').filter(Boolean)) {
    chips.push({ label: domainLabel(domain), clears: [`domain=${domain}`] });
  }
  const action = params.get('action');
  if (action) chips.push({ label: actionLabel(action), clears: ['action'] });
  const source = params.get('source');
  if (source) chips.push({ label: SOURCES.find((s) => s.value === source)?.label ?? source, clears: ['source'] });
  const q = params.get('q');
  if (q) chips.push({ label: `« ${q} »`, clears: ['q'] });
  return chips;
}

/** The address without what a chip stands for (`domain=x` removes one domain of the list). */
export function withoutChip(params: URLSearchParams, chip: FilterChip): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const clear of chip.clears) {
    const [name, value] = clear.split('=');
    if (value === undefined) {
      next.delete(name);
    } else {
      const rest = (next.get(name) ?? '').split(',').filter((item) => item && item !== value);
      if (rest.length) next.set(name, rest.join(','));
      else next.delete(name);
    }
  }
  // Removing the period of a history keeps it whole; of the list, back to the default
  if (chip.clears.includes('period') && !next.get('ref') && !next.get('actor') && !next.get('request')) {
    next.set('period', 'all');
  }
  return next;
}
