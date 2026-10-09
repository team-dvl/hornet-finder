import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Container, Spinner } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { HelpTip } from '../../components/common';
import { IconButton } from '../../components/ui';
import {
  AuditEventModal, AuditEventRow, AuditExportSheet, AuditFiltersSheet, type AuditFocus,
} from '../../components/audit';
import { AuditError, fetchAuditEvents, fetchAuditPage, type AuditEvent } from '../../utils/auditApi';
import { actionLabel, DOMAINS } from '../../utils/auditLabels';
import { filterChips, toFilters, withoutChip } from '../../utils/auditFilters';
import { formatDate, toDateInputValue } from '../../utils/format';
import { ACTION_ICONS } from '../../utils/icons';

const message = (error: unknown) => (error instanceof AuditError ? error.message : String(error));

/** "Aujourd'hui", "Hier", else the date */
function dayTitle(day: string): string {
  const today = toDateInputValue();
  const yesterday = toDateInputValue(Date.now() - 24 * 3600 * 1000);
  if (day === today) return "Aujourd'hui";
  if (day === yesterday) return 'Hier';
  return formatDate(`${day}T12:00:00`);
}

/** Events grouped by local day, newest first */
function byDay(events: AuditEvent[]): [string, AuditEvent[]][] {
  const groups = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const day = toDateInputValue(event.occurred_at);
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return [...groups.entries()];
}

/**
 * Audit trail (platform admins only): who did what, when, on which object.
 * The filters live in the address, so the history of an object is a link
 * (`/admin/audit?ref=trap:12`) and Back returns to the previous filters.
 */
export default function AuditTrail() {
  const [params, setParams] = useSearchParams();
  const paramsKey = params.toString();
  const filters = useMemo(() => toFilters(new URLSearchParams(paramsKey)), [paramsKey]);

  // The list is tied to the filters that fetched it: a stale one reads as loading
  const [list, setList] = useState<{ key: string; events: AuditEvent[]; next: string | null; error?: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'filters' | 'export' | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  useEffect(() => {
    let current = true;
    fetchAuditEvents(filters)
      .then((page) => { if (current) setList({ key: paramsKey, events: page.results, next: page.next }); })
      .catch((e: unknown) => { if (current) setList({ key: paramsKey, events: [], next: null, error: message(e) }); });
    return () => { current = false; };
  }, [filters, paramsKey]);

  const fresh = list?.key === paramsKey ? list : null;
  const events = fresh && !fresh.error ? fresh.events : null;
  const next = fresh?.next ?? null;
  const listError = fresh?.error ?? null;

  const loadMore = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await fetchAuditPage(next);
      setList((previous) => previous && ({
        ...previous, events: [...previous.events, ...page.results], next: page.next,
      }));
    } catch (e) {
      setError(message(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const change = useCallback((changes: Record<string, string | null>) => {
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      for (const [name, value] of Object.entries(changes)) {
        if (value) updated.set(name, value);
        else updated.delete(name);
      }
      return updated;
    }, { replace: true });
  }, [setParams]);

  /** A link of the detail: a new history, in the browser's history so Back returns here */
  const focus = (target: AuditFocus) => {
    setSelected(null);
    const updated = new URLSearchParams();
    if (target.ref) {
      updated.set('ref', target.ref);
      if (target.refName) updated.set('ref_name', target.refName);
    }
    if (target.actor) {
      updated.set('actor', target.actor);
      if (target.actorName) updated.set('actor_name', target.actorName);
    }
    if (target.request) updated.set('request', target.request);
    setParams(updated);
  };

  const chips = filterChips(params, actionLabel, (domain) => DOMAINS[domain]?.label ?? domain);
  const activeCount = chips.length;

  return (
    <PageLayout>
      <Container className="py-4 audit-page">
        <PageHeader
          title="Journal d'audit"
          help="Qui a fait quoi, quand, sur chaque objet."
          actions={(
            <>
              <IconButton
                variant="outline-secondary"
                icon={ACTION_ICONS.filters}
                label={activeCount ? `Filtres (${activeCount})` : 'Filtres'}
                onClick={() => setSheet('filters')}
              />
              <IconButton
                variant="outline-secondary"
                icon={ACTION_ICONS.export}
                label="Exporter"
                onClick={() => setSheet('export')}
                disabled={!events?.length}
              />
            </>
          )}
        />

        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          {chips.map((chip) => (
            <Button
              key={chip.clears.join()}
              variant="outline-secondary"
              className="rounded-pill stat-chip audit-filter-chip"
              aria-label={`Retirer le filtre ${chip.label}`}
              onClick={() => setParams(withoutChip(params, chip), { replace: true })}
            >
              <span className="text-truncate">{chip.label}</span>
              <i className="bi bi-x-lg ms-1 flex-shrink-0" aria-hidden="true" />
            </Button>
          ))}
          <HelpTip id="audit-help" title="Journal d'audit" doc="admin#audit">
            Chaque action sur les nids, frelons, ruchers, pièges, QR codes, groupes, invitations et
            exports est enregistrée avec son auteur, gardée un an et jamais modifiable. Les événements
            « reconstitués » viennent des dates déjà enregistrées avant la mise en service du journal.
          </HelpTip>
        </div>

        {listError && <Alert variant="danger">{listError}</Alert>}
        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

        {!fresh && <Spinner animation="border" size="sm" />}
        {events?.length === 0 && <p className="text-muted">Aucun événement pour ces filtres.</p>}

        {events && events.length > 0 && byDay(events).map(([day, dayEvents]) => (
          <section key={day} aria-label={dayTitle(day)}>
            <h3 className="audit-day">{dayTitle(day)}</h3>
            {dayEvents.map((event) => <AuditEventRow key={event.id} event={event} onOpen={setSelected} />)}
          </section>
        ))}

        {next && (
          <div className="text-center mt-3">
            <Button variant="outline-secondary" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Chargement…' : "Plus d'événements"}
            </Button>
          </div>
        )}
      </Container>

      <AuditEventModal event={selected} onHide={() => setSelected(null)} onFocus={focus} />
      <AuditFiltersSheet show={sheet === 'filters'} onHide={() => setSheet(null)} params={params} onChange={change} />
      {sheet === 'export' && <AuditExportSheet onHide={() => setSheet(null)} filters={filters} />}
    </PageLayout>
  );
}
