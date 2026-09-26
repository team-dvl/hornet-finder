import { Marker, Tooltip } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import * as L from 'leaflet';
import { useMemo, useRef } from 'react';
import { Trap } from '../../store/slices/trapsSlice';
import '../../styles/markerFocus.css';

/**
 * Marker of a trap. The colour carries the status (green in service, grey
 * stored), a thicker ring marks the traps of the current user, and the badge
 * shows the number of Asian hornets caught when there is at least one.
 */
const createTrapIcon = (trap: Trap, isMine: boolean, isMoving: boolean, highlighted: boolean) => {
  const color = trap.active ? '#198754' : '#6c757d';
  const ring = isMine ? '#ffc107' : 'white';
  const ringWidth = isMine ? 3 : 2;
  const badge = trap.hornet_catch_count > 0 ? `
      <circle cx="26" cy="7" r="7" fill="#dc3545" stroke="white" stroke-width="1.5"/>
      <text x="26" y="10.5" text-anchor="middle" font-size="9" font-weight="bold" fill="white">${
        trap.hornet_catch_count > 99 ? '99+' : trap.hornet_catch_count
      }</text>` : '';

  const svg = `
    <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="${ring}" stroke-width="${ringWidth}"
              ${isMoving ? 'stroke-dasharray="4 3"' : ''}/>
      <text x="16" y="21" text-anchor="middle" font-size="15" fill="white">🪤</text>
      ${badge}
    </svg>
  `;

  return new DivIcon({
    html: svg,
    iconSize: [34, 34],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: highlighted ? 'trap-icon map-marker-focus' : 'trap-icon'
  });
};

interface TrapMarkerProps {
  trap: Trap;
  isMine?: boolean;
  /** When true the marker can be dragged to reposition the trap */
  isMoving?: boolean;
  /** Position reached by the drag, not saved yet; the trap's own otherwise */
  pendingPosition?: { lat: number; lng: number } | null;
  onClick?: (trap: Trap) => void;
  onMoved?: (trap: Trap, latitude: number, longitude: number) => void;
  /** Trap reached from "Locate" in the trap manager: pulses to be spotted */
  highlighted?: boolean;
}

export default function TrapMarker({
  trap, isMine = false, isMoving = false, pendingPosition = null, onClick, onMoved,
  highlighted = false,
}: TrapMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  // react-leaflet compares `position` by reference and this array is rebuilt on
  // every render, so it always calls setLatLng: a marker dragged to a position
  // that is not in the store yet would be pulled back to the stored one.
  const position: [number, number] = pendingPosition
    ? [pendingPosition.lat, pendingPosition.lng]
    : [trap.latitude, trap.longitude];

  // Same reason: a new icon object on every render means a new DOM element,
  // which would interrupt a drag in progress.
  const icon = useMemo(
    () => createTrapIcon(trap, isMine, isMoving, highlighted),
    [trap, isMine, isMoving, highlighted],
  );

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      draggable={isMoving}
      // Under the nests, above the apiaries; a highlighted trap above everything
      zIndexOffset={highlighted ? 1000 : 150}
      eventHandlers={{
        click: () => {
          // Pendant un déplacement, le clic ne doit pas rouvrir la fiche
          if (!isMoving) onClick?.(trap);
        },
        dragend: (event) => {
          const { lat, lng } = (event.target as L.Marker).getLatLng();
          onMoved?.(trap, lat, lng);
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -16]}>
        <strong>{trap.trap_type.name}</strong>
        {!trap.active && ' (remisé)'}
        {trap.hornet_catch_count > 0 && (
          <>
            <br />
            {trap.hornet_catch_count} frelon{trap.hornet_catch_count > 1 ? 's' : ''} asiatique
            {trap.hornet_catch_count > 1 ? 's' : ''}
          </>
        )}
      </Tooltip>
    </Marker>
  );
}
