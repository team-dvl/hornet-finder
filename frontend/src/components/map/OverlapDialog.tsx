import { ListGroup, Badge, Button } from 'react-bootstrap';
import { Apiary } from '../../store/slices/apiariesSlice';
import { Nest } from '../../store/slices/nestsSlice';
import { MapObject, MapObjectType } from './types';
import { ColorSelector } from '../../components/forms';
import { BottomSheet } from '../ui';

interface OverlapDialogProps {
  show: boolean;
  onHide: () => void;
  objects: MapObject[];
  onSelectObject: (object: MapObject) => void;
  position: { lat: number; lng: number };
  /** Shown when zooming in would pull the markers apart */
  onZoomToSeparate?: () => void;
}

const INFESTATION: Record<1 | 2 | 3, { bg: string; text: string }> = {
  1: { bg: 'warning', text: 'Faible' },
  2: { bg: 'warning', text: 'Modérée' },
  3: { bg: 'danger', text: 'Élevée' },
};

/** One status badge per object, when its type has one */
function StatusBadge({ object }: { object: MapObject }) {
  if (object.type === MapObjectType.APIARY && object.data) {
    const level = INFESTATION[(object.data as Apiary).infestation_level];
    return <Badge bg={level.bg}>{level.text}</Badge>;
  }
  if (object.type === MapObjectType.NEST && object.data) {
    const destroyed = (object.data as Nest).destroyed;
    return <Badge bg={destroyed ? 'secondary' : 'danger'}>{destroyed ? 'Détruit' : 'Actif'}</Badge>;
  }
  return null;
}

/** Choice among the objects under one tap of the map. */
export default function OverlapDialog({ show, onHide, objects, onSelectObject, onZoomToSeparate }: OverlapDialogProps) {
  // The map shows a single modal: opening the selected sheet replaces this
  // one, so closing it here as well would close the sheet just opened.
  return (
    <BottomSheet show={show} onHide={onHide} title={`${objects.length} objets à cet endroit`}>
      <ListGroup variant="flush">
        {objects.map((object, index) => (
          <ListGroup.Item
            key={`${object.type}-${object.id}-${index}`}
            action
            onClick={() => onSelectObject(object)}
            className="d-flex align-items-center gap-3 px-1 py-2"
          >
            <span className="flex-shrink-0 text-center" style={{ fontSize: '1.5rem', width: '2rem' }} aria-hidden="true">
              {object.symbol}
            </span>
            <span className="flex-grow-1 min-w-0">
              <span className="d-block fw-semibold text-truncate">{object.title}</span>
              {object.subtitle && object.type !== MapObjectType.APIARY && object.type !== MapObjectType.NEST && (
                <span className="d-block small text-muted text-truncate">{object.subtitle}</span>
              )}
            </span>
            <StatusBadge object={object} />
            {object.colors?.map((color, colorIndex) => (
              <ColorSelector key={colorIndex} value={color} readOnly size="sm" />
            ))}
            <i className="bi bi-chevron-right text-muted flex-shrink-0" aria-hidden="true" />
          </ListGroup.Item>
        ))}
      </ListGroup>

      {onZoomToSeparate && (
        <Button
          variant="outline-secondary"
          className="w-100 mt-2"
          onClick={() => {
            onZoomToSeparate();
            onHide();
          }}
        >
          <i className="bi bi-zoom-in me-2" aria-hidden="true" />
          Zoomer pour les distinguer
        </Button>
      )}
    </BottomSheet>
  );
}
