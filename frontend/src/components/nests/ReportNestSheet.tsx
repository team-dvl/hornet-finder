import { useState } from 'react';
import { Alert, ListGroup, Spinner } from 'react-bootstrap';
import { BottomSheet } from '../ui';
import { AddressSearch } from '../traps';
import { currentPosition } from '../../utils/position';

interface ReportNestSheetProps {
  show: boolean;
  onHide: () => void;
  /** The place of the nest is known: open the report form there */
  onPlace: (lat: number, lng: number) => void;
  /** Pick the place on the map instead */
  onMap: () => void;
}

/** First step of a report: where the nest is (the phone's position, the map, an address). */
export default function ReportNestSheet({ show, onHide, onPlace, onMap }: ReportNestSheetProps) {
  const [locating, setLocating] = useState(false);
  const [byAddress, setByAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setByAddress(false);
    setError(null);
    onHide();
  };

  const here = async () => {
    setLocating(true);
    setError(null);
    try {
      const { lat, lon } = await currentPosition();
      setByAddress(false);
      onPlace(lat, lon);
    } catch {
      setError("La position de l'appareil n'est pas disponible : choisissez sur la carte ou par une adresse.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <BottomSheet show={show} onHide={close} title="Où est le nid ?">
      {error && <Alert variant="warning" className="py-2 small">{error}</Alert>}
      {byAddress ? (
        <AddressSearch label="Adresse du nid" onSelect={(found) => { setByAddress(false); onPlace(found.latitude, found.longitude); }} />
      ) : (
        <ListGroup variant="flush">
          <ListGroup.Item action onClick={() => void here()} disabled={locating} className="d-flex align-items-center gap-3 px-1 py-2">
            {locating ? <Spinner animation="border" size="sm" /> : <i className="bi bi-crosshair fs-5" aria-hidden="true" />}
            Ma position
          </ListGroup.Item>
          <ListGroup.Item action onClick={() => { close(); onMap(); }} className="d-flex align-items-center gap-3 px-1 py-2">
            <i className="bi bi-map fs-5" aria-hidden="true" />
            Choisir sur la carte
          </ListGroup.Item>
          <ListGroup.Item action onClick={() => setByAddress(true)} className="d-flex align-items-center gap-3 px-1 py-2">
            <i className="bi bi-search fs-5" aria-hidden="true" />
            Une adresse
          </ListGroup.Item>
        </ListGroup>
      )}
    </BottomSheet>
  );
}
