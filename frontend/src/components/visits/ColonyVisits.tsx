import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../utils/format';
import { fetchVisits, inspectionSummary, type Visit } from '../../utils/visitsApi';

interface ColonyVisitsProps {
  colonyId: string;
}

/** The latest visits where a colony was looked at, in its sheet; a visit opens in the journal. */
export default function ColonyVisits({ colonyId }: ColonyVisitsProps) {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVisits({ colony: colonyId })
      .then((page) => { if (!cancelled) setVisits(page.results.slice(0, 5)); })
      .catch(() => { if (!cancelled) setVisits([]); });
    return () => { cancelled = true; };
  }, [colonyId]);

  if (!visits?.length) return null;
  return (
    <section className="mt-3" aria-label="Visites de la colonie">
      <div className="text-muted small mb-1">Visites</div>
      <div className="list-group">
        {visits.map((visit) => {
          const inspection = visit.inspections.find((item) => item.colony === colonyId);
          const summary = inspection ? inspectionSummary(inspection) : [];
          return (
            <button key={visit.id} type="button" className="list-group-item list-group-item-action py-2 px-2 text-start"
              onClick={() => navigate(`/apiaries/visits?visit=${visit.id}`)}>
              <span className="d-block small fw-semibold">{formatDateTime(visit.started_at)}</span>
              {summary.length > 0 && <span className="d-block small text-muted">{summary.join(' · ')}</span>}
              {inspection?.notes && <span className="d-block small text-truncate">{inspection.notes}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
