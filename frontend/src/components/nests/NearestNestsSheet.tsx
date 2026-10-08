import { useEffect, useState } from 'react';
import { Alert, Badge, ListGroup, Spinner } from 'react-bootstrap';
import { fetchNestsAround, NEAREST_NESTS_RADIUS_KM, type Nest } from '../../store/store';
import { BottomSheet } from '../ui';
import { HelpTip } from '../common';
import { currentPosition } from '../../utils/position';
import { distanceKm } from '../../utils/geo';
import { formatDate, formatDistance } from '../../utils/format';

/** Longer lists are cut: the map shows the rest */
const MAX_NESTS = 20;

interface NearestNestsSheetProps {
  show: boolean;
  onHide: () => void;
  /** Opens the sheet of the chosen nest (and centres the map on it) */
  onSelect: (nest: Nest) => void;
}

type Item = { nest: Nest; meters: number };
type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: Item[] };

/** The nests within 5 km of the user, nearest first, with their distance. */
export default function NearestNestsSheet({ show, onHide, onSelect }: NearestNestsSheetProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    (async () => {
      try {
        const { lat, lon } = await currentPosition();
        const nests = await fetchNestsAround(lat, lon);
        const items = nests
          .map((nest) => ({ nest, meters: distanceKm(lat, lon, nest.latitude, nest.longitude) * 1000 }))
          .sort((a, b) => a.meters - b.meters)
          .slice(0, MAX_NESTS);
        if (!cancelled) setState({ status: 'ready', items });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', message: (error as Error).message || 'Liste indisponible' });
      }
    })();
    return () => {
      cancelled = true;
      setState({ status: 'loading' });
    };
  }, [show]);

  return (
    <BottomSheet
      show={show}
      onHide={onHide}
      title={(
        <span className="d-inline-flex align-items-center">
          Nids les plus proches
          <HelpTip id="nearest-nests-help" title="Nids les plus proches">
            Les nids de l&apos;année à {NEAREST_NESTS_RADIUS_KM} km au plus de votre position, du plus
            proche au plus éloigné ({MAX_NESTS} au plus). La distance est à vol d&apos;oiseau.
          </HelpTip>
        </span>
      )}
    >
      {state.status === 'loading' && (
        <div className="text-center py-3"><Spinner animation="border" size="sm" className="me-2" />Localisation…</div>
      )}
      {state.status === 'error' && <Alert variant="warning" className="mb-0">{state.message}</Alert>}
      {state.status === 'ready' && state.items.length === 0 && (
        <p className="text-muted mb-0 py-2">Aucun nid à moins de {NEAREST_NESTS_RADIUS_KM} km.</p>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <ListGroup variant="flush">
          {state.items.map(({ nest, meters }) => (
            <ListGroup.Item
              key={nest.id}
              action
              onClick={() => onSelect(nest)}
              className="d-flex align-items-center gap-2 px-1 py-2"
            >
              <span className="flex-shrink-0 fw-semibold nearest-nest-distance">{formatDistance(meters)}</span>
              <span className="flex-grow-1 min-w-0">
                <span className="d-block text-truncate">{nest.address || `Nid #${nest.id}`}</span>
                {nest.created_at && (
                  <span className="d-block small text-muted text-truncate">Signalé le {formatDate(nest.created_at)}</span>
                )}
              </span>
              <Badge bg={nest.destroyed ? 'secondary' : 'danger'} className="flex-shrink-0 fw-normal">
                {nest.destroyed ? 'Détruit' : 'Actif'}
              </Badge>
              <i className="bi bi-chevron-right text-muted flex-shrink-0" aria-hidden="true" />
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </BottomSheet>
  );
}
