import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { fetchNearbyApiaries, type NearbyApiary } from '../../store/store';
import { HelpTip } from '../common';
import { formatDistance } from '../../utils/format';

/** AFSCA numbers of the apiaries within 1 km of a nest, nearest first. */
export default function NearbyApiaries({ nestId }: { nestId: number }) {
  const [state, setState] = useState<{ nestId: number; apiaries: NearbyApiary[] | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNearbyApiaries(nestId)
      .then((apiaries) => { if (!cancelled) setState({ nestId, apiaries }); })
      .catch(() => { if (!cancelled) setState({ nestId, apiaries: null }); });
    return () => { cancelled = true; };
  }, [nestId]);

  const current = state?.nestId === nestId ? state : null;

  return (
    <div className="mt-2">
      <div className="text-muted small d-flex align-items-center">
        Ruchers à moins de 1 km
        <HelpTip id={`nest-${nestId}-apiaries-help`} title="Ruchers proches">
          Numéros AFSCA des ruchers situés à 1 km au plus du nid, du plus proche au plus
          éloigné. Les ruchers sans numéro AFSCA ne sont pas repris.
        </HelpTip>
      </div>
      {!current && <Spinner animation="border" size="sm" className="mt-1" />}
      {current && current.apiaries === null && <div className="small text-danger">Liste indisponible</div>}
      {current?.apiaries?.length === 0 && <div className="small">Aucun</div>}
      {current?.apiaries && current.apiaries.length > 0 && (
        <ul className="list-unstyled small mb-0">
          {current.apiaries.map((apiary) => (
            <li key={apiary.afsca_number} className="field-row">
              <code className="text-truncate">{apiary.afsca_number}</code>
              <span className="text-muted flex-shrink-0">{formatDistance(apiary.distance_m)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
