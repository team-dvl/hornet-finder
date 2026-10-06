import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import { useAppSelector } from '../../store/hooks';
import { selectMapAnalysis } from '../../store/store';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import StatGridLegend from './StatGridLegend';
import StatGridOverlay, { type GridState } from './StatGridOverlay';
import { analysisParams } from './statParams';

/**
 * Coverage or pressure of the traps over the main map, chosen in the layers
 * sheet. The cells let taps through to the map; the legend (or the reason
 * nothing is drawn) floats at the bottom of the map.
 */
export default function MapAnalysisLayer() {
  const map = useMap();
  const analysis = useAppSelector(selectMapAnalysis);
  const { roles } = useUserPermissions();
  const [grid, setGrid] = useState<GridState | null>(null);
  // Statistics are open to every role
  const allowed = roles.length > 0;
  if (!analysis.layer || !allowed) return null;

  const statId = analysis.layer === 'coverage' ? 'traps-coverage' : 'traps-pressure';
  const params = analysisParams(analysis.period, analysis.year);
  const message = grid?.tooLarge
    ? 'Zoomez pour afficher la couche.'
    : grid?.error ?? (grid?.result && grid.result.cells.features.length === 0
      ? `${analysis.layer === 'coverage' ? 'Aucun piège en service ici' : 'Pas assez de relevés ici'}\u00a0: ${grid.result.period.label.toLowerCase()}.`
      : null);

  return (
    <>
      <StatGridOverlay statId={statId} params={params} onState={setGrid} interactive={false} />
      {createPortal(
        message
          ? <div className="stat-legend stat-legend-overlay">{message}</div>
          : <StatGridLegend layer={analysis.layer} bins={grid?.result?.bins} variant="overlay" />,
        map.getContainer(),
      )}
    </>
  );
}
