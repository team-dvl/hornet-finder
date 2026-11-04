import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '../ui';
import { ACTION_ICONS } from '../../utils/icons';
import { formatDateTime } from '../../utils/format';
import { fetchVisits, visitLabel, type Visit } from '../../utils/visitsApi';

interface ApiaryVisitsProps {
  apiaryId: number;
}

/** The latest visit of an apiary in its sheet, and the way to record the next one. */
export default function ApiaryVisits({ apiaryId }: ApiaryVisitsProps) {
  const navigate = useNavigate();
  const [latest, setLatest] = useState<{ visit: Visit | null; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVisits({ apiary: apiaryId })
      .then((page) => { if (!cancelled) setLatest({ visit: page.results[0] ?? null, count: page.count }); })
      .catch(() => { if (!cancelled) setLatest(null); });
    return () => { cancelled = true; };
  }, [apiaryId]);

  return (
    <section className="mt-3" aria-label="Visites du rucher">
      <div className="d-flex align-items-center gap-2">
        <span className="text-muted small flex-grow-1 min-w-0 text-truncate">
          Visites{latest ? ` (${latest.count})` : ''}
          {latest?.visit && ` · dernière le ${formatDateTime(latest.visit.started_at)}`}
        </span>
        {latest && latest.count > 0 && (
          <IconButton variant="outline-secondary" icon="journal-text" label="Journal"
            onClick={() => navigate(`/apiaries/visits?apiary=${apiaryId}`)} />
        )}
        <IconButton variant="outline-secondary" icon={ACTION_ICONS.add} label="Nouvelle visite"
          onClick={() => navigate(`/apiaries/visits?apiary=${apiaryId}&add=1`)} />
      </div>
      {latest?.visit && (
        <button type="button" className="btn btn-link p-0 small text-start text-truncate mw-100"
          onClick={() => navigate(`/apiaries/visits?apiary=${apiaryId}&visit=${latest.visit!.id}`)}>
          {visitLabel(latest.visit)}
        </button>
      )}
    </section>
  );
}
