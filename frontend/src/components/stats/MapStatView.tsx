import { useState } from 'react';
import { Alert, Button, ButtonGroup, Spinner } from 'react-bootstrap';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import { HelpTip } from '../common';
import { useAppSelector } from '../../store/hooks';
import { selectMapCenter } from '../../store/store';
import type { GridCellProperties, GridShape, StatParams } from '../../utils/statsApi';
import StatGridLegend from './StatGridLegend';
import StatGridOverlay, { type GridState } from './StatGridOverlay';
import { formatPercent, formatRate } from './statParams';

interface MapStatViewProps {
  statId: 'traps-coverage' | 'traps-pressure';
  params: StatParams;
  onParams: (changes: StatParams) => void;
  onState: (state: GridState) => void;
}

const DISTANCES = ['100', '250', '500'];
const GRIDS: { value: GridShape; label: string; icon: string }[] = [
  { value: 'square', label: 'Carré', icon: 'square' },
  { value: 'hex', label: 'Hexagone', icon: 'hexagon' },
];
const LOCALE = 'fr-BE';

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-kpi">
      <div className="stat-kpi-value">{value}</div>
      <div className="stat-kpi-label">{label}</div>
    </div>
  );
}

/** Coverage or pressure of the traps on a grid of 6.25 ha cells, over the map view or a zone. */
export default function MapStatView({ statId, params, onParams, onState }: MapStatViewProps) {
  const center = useAppSelector(selectMapCenter);
  const [grid, setGrid] = useState<GridState>({ loading: true, bbox: null });
  const [selected, setSelected] = useState<GridCellProperties | null>(null);
  const coverage = statId === 'traps-coverage';
  const parameter = coverage ? 'reach' : 'bandwidth';
  const distance = params[parameter] || '250';
  const gridShape: GridShape = params.grid === 'hex' ? 'hex' : 'square';
  const result = grid.result;
  const summary = result?.summary;

  const report = (state: GridState) => {
    setGrid(state);
    onState(state);
  };

  let readout = 'Touchez une maille pour la détailler.';
  if (selected && coverage) {
    readout = `Maille couverte à ${formatPercent(selected.covered)} · ${selected.traps ?? 0} piège${(selected.traps ?? 0) > 1 ? 's' : ''} à moins de ${distance}\u00a0m de son centre.`;
  } else if (selected) {
    readout = `${formatRate(selected.rate)} frelon par piège et par semaine · effort de ${Math.round(selected.effort ?? 0)} pièges-jours (pondéré) autour de la maille.`;
  }

  return (
    <>
      {summary && (
        <div className="stat-kpis mb-2">
          {coverage ? (
            <>
              <Kpi value={formatPercent(summary.coverage)} label="de la zone couverte" />
              <Kpi value={String(summary.traps)} label="pièges en service dans la zone" />
              <Kpi
                value={summary.density === null || summary.density === undefined ? '–' : summary.density.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}
                label="pièges par km²"
              />
            </>
          ) : (
            <>
              <Kpi value={formatRate(summary.rate)} label="frelons par piège et par semaine" />
              <Kpi value={String(summary.traps)} label="pièges en service dans la zone" />
              <Kpi value={Math.round(summary.trap_days ?? 0).toLocaleString(LOCALE)} label="pièges-jours" />
            </>
          )}
        </div>
      )}

      <div className="stat-map">
        <MapContainer
          center={[center.latitude, center.longitude]}
          zoom={13}
          zoomControl={false}
          scrollWheelZoom
          className="h-100 w-100"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ZoomControl position="bottomleft" />
          <StatGridOverlay
            statId={statId}
            params={params}
            onState={report}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            showTraps
          />
        </MapContainer>
        {grid.loading && <Spinner animation="border" size="sm" className="stat-map-spinner" />}
        {grid.error && (
          <div className="stat-map-message">
            {grid.tooLarge ? grid.error : <Alert variant="danger" className="small py-2 mb-0">{grid.error}</Alert>}
          </div>
        )}
      </div>

      <div className="small mt-2 stat-readout">{readout}</div>
      <StatGridLegend layer={coverage ? 'coverage' : 'pressure'} bins={result?.bins} />
      {result && (
        <div className="small text-muted mt-1">
          Surface étudiée : {result.area.km2.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} km²
          {result.area.kind === 'bbox' ? ' (la carte affichée)' : ' (la zone choisie)'} ·{' '}
          {result.parameters.grid === 'hex' ? 'mailles hexagonales de 6,25 ha' : `mailles de ${result.parameters.cell} m`}
        </div>
      )}

      <div className="d-flex align-items-center mt-3 mb-1 fw-semibold small">
        Maille
        <HelpTip id="stat-grid-help" doc="stats#coverage" title="Maille">
          Carrés de 250 m ou hexagones de même surface (6,25 ha, 155 m de côté). Les totaux de la
          zone ne changent pas. Un hexagone a six voisins à la même distance (269 m), un carré
          quatre à 250 m et quatre en diagonale à 354 m : les hexagones évitent les effets
          d&apos;escalier et de diagonale du dessin.
        </HelpTip>
      </div>
      <ButtonGroup className="w-100" role="radiogroup" aria-label="Maille">
        {GRIDS.map(({ value, label, icon }) => (
          <Button
            key={value}
            variant={gridShape === value ? 'primary' : 'outline-primary'}
            role="radio"
            aria-checked={gridShape === value}
            onClick={() => { setSelected(null); onParams({ grid: value === 'square' ? '' : value }); }}
          >
            <i className={`bi bi-${icon} me-2`} aria-hidden="true" />
            {label}
          </Button>
        ))}
      </ButtonGroup>

      <div className="d-flex align-items-center mt-3 mb-1 fw-semibold small">
        {coverage ? "Rayon d'action supposé d'un piège" : 'Lissage'}
        <HelpTip id="stat-distance-help" doc="stats#coverage" title={coverage ? "Rayon d'action" : 'Lissage'}>
          {coverage
            ? "Chaque piège en service couvre un disque de ce rayon. La portée réelle d'un piège appâté n'est pas établie et dépend de l'appât et du vent : c'est une hypothèse de travail, rappelée dans les exports. À surface égale, 5 pièges par km² font des disques d'environ 250 m, 1 par km² d'environ 560 m."
            : "Chaque maille reçoit les captures des pièges voisins, pondérées par la distance (noyau gaussien de cette largeur), divisées par leur effort pondéré. Une maille trop loin des pièges (moins de 7 pièges-jours pondérés) reste transparente : pas de couleur sans effort de piégeage."}
        </HelpTip>
      </div>
      <ButtonGroup className="w-100" role="radiogroup" aria-label={coverage ? "Rayon d'action" : 'Lissage'}>
        {DISTANCES.map((value) => (
          <Button
            key={value}
            variant={distance === value ? 'primary' : 'outline-primary'}
            role="radio"
            aria-checked={distance === value}
            onClick={() => { setSelected(null); onParams({ [parameter]: value }); }}
          >
            {value} m
          </Button>
        ))}
      </ButtonGroup>
    </>
  );
}
