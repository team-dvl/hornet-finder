import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { fetchNearbyApiaries } from '../../store/store';
import { HelpTip } from '../common';

/** AFSCA numbers of the apiaries within 1 km of a nest, sorted by number (never by distance). */
export default function NearbyApiaries({ nestId }: { nestId: number }) {
  const [state, setState] = useState<{ nestId: number; numbers: string[] | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNearbyApiaries(nestId)
      .then((numbers) => { if (!cancelled) setState({ nestId, numbers }); })
      .catch(() => { if (!cancelled) setState({ nestId, numbers: null }); });
    return () => { cancelled = true; };
  }, [nestId]);

  const current = state?.nestId === nestId ? state : null;

  return (
    <div className="mt-2">
      <div className="text-muted small d-flex align-items-center">
        Ruchers à moins de 1 km
        <HelpTip id={`nest-${nestId}-apiaries-help`} title="Ruchers proches">
          Numéros AFSCA des ruchers situés à 1 km au plus du nid, par ordre de numéro.
          Les ruchers sans numéro AFSCA ne sont pas repris.
        </HelpTip>
      </div>
      {!current && <Spinner animation="border" size="sm" className="mt-1" />}
      {current && current.numbers === null && <div className="small text-danger">Liste indisponible</div>}
      {current?.numbers?.length === 0 && <div className="small">Aucun</div>}
      {current?.numbers && current.numbers.length > 0 && (
        <ul className="list-unstyled small mb-0">
          {current.numbers.map((number) => (
            <li key={number} className="py-1 text-truncate"><code>{number}</code></li>
          ))}
        </ul>
      )}
    </div>
  );
}
