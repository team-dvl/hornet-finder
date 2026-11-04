import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDateTime } from '../../utils/format';
import { fetchVisits, visitLabel, type Visit } from '../../utils/visitsApi';

interface ApiaryVisitsProps {
  apiaryId: number;
}

interface Summary {
  latest: Visit | null;
  count: number;
  next: Visit | null;
}

/** In the sheet of an apiary: its next planned visit, its latest one, and the ways to plan or record one. */
export default function ApiaryVisits({ apiaryId }: ApiaryVisitsProps) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchVisits({ apiary: apiaryId }), fetchVisits({ apiary: apiaryId, status: 'planned' })])
      .then(([done, planned]) => {
        if (!cancelled) setSummary({ latest: done.results[0] ?? null, count: done.count, next: planned.results[0] ?? null });
      })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [apiaryId]);

  const open = (visit: Visit, view = '') => navigate(`/apiaries/visits?apiary=${apiaryId}${view}&visit=${visit.id}`);

  return (
    <section className="mt-3" aria-label="Visites du rucher">
      <div className="d-flex align-items-center gap-2">
        <span className="text-muted small flex-grow-1 min-w-0 text-truncate">
          Visites{summary ? ` (${summary.count})` : ''}
          {summary?.latest && ` · dernière le ${formatDateTime(summary.latest.started_at)}`}
        </span>
        {summary && summary.count > 0 && (
          <IconButton variant="outline-secondary" icon="journal-text" label="Journal"
            onClick={() => navigate(`/apiaries/visits?apiary=${apiaryId}&view=journal`)} />
        )}
        <IconButton variant="outline-secondary" icon="calendar-plus" label="Prévoir une visite"
          onClick={() => navigate(`/apiaries/visits?apiary=${apiaryId}&plan=1`)} />
        <IconButton variant="outline-secondary" icon={ACTION_ICONS.add} label="Nouvelle visite"
          onClick={() => navigate(`/apiaries/visits?apiary=${apiaryId}&view=journal&add=1`)} />
      </div>
      {summary?.next && (
        <button type="button" className="btn btn-link p-0 small text-start text-truncate mw-100 d-block"
          onClick={() => open(summary.next!)}>
          <i className="bi bi-calendar-event me-1" aria-hidden="true" />
          {formatDateTime(summary.next.started_at)} · {visitLabel(summary.next)}
        </button>
      )}
      {summary?.latest && (
        <button type="button" className="btn btn-link p-0 small text-start text-truncate mw-100 d-block"
          onClick={() => open(summary.latest!, '&view=journal')}>
          {visitLabel(summary.latest)}
        </button>
      )}
    </section>
  );
}
