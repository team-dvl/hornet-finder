import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import {
  fetchStat, StatsError, type GridCellProperties, type MapStatResult, type StatParams,
} from '../../utils/statsApi';
import { cellStyle, type GridLayer } from './gridStyle';

export interface GridState {
  loading: boolean;
  result?: MapStatResult;
  error?: string;
  /** 422: the area is too large to draw */
  tooLarge?: boolean;
  /** `ouest,sud,est,nord` of the view asked for, when there is no zone */
  bbox: string | null;
}

interface StatGridOverlayProps {
  statId: 'traps-coverage' | 'traps-pressure';
  params: StatParams;
  onState?: (state: GridState) => void;
  selectedId?: string | null;
  onSelect?: (cell: GridCellProperties | null) => void;
  /** Draw the traps counted (the stat page does, the main map has its own markers) */
  showTraps?: boolean;
}

const LAYERS: Record<StatGridOverlayProps['statId'], GridLayer> = {
  'traps-coverage': 'coverage',
  'traps-pressure': 'pressure',
};

/** The view as the API's `bbox`, rounded to ~10 m so a nudge does not refetch. */
function viewBox(map: L.Map): string {
  const bounds = map.getBounds();
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    .map((value) => value.toFixed(4)).join(',');
}

type Loaded = { key: string; result?: MapStatResult; error?: string; status?: number };

/**
 * The 250 m grid of a map statistic, inside a react-leaflet map. Without a
 * zone it follows the view: each move asks for the cells of the new view.
 * Drawn on a canvas, which keeps a few thousand cells fluid on a phone.
 */
export default function StatGridOverlay({
  statId, params, onState, selectedId = null, onSelect, showTraps = false,
}: StatGridOverlayProps) {
  const map = useMap();
  const layer = LAYERS[statId];
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);
  const [bbox, setBbox] = useState(() => viewBox(map));
  const timer = useRef<number | undefined>(undefined);

  useMapEvents({
    moveend: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setBbox(viewBox(map)), 350);
    },
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const zone = useMemo(() => (params.radius && params.lat && params.lon
    ? { lat: Number(params.lat), lon: Number(params.lon), km: Number(params.radius) }
    : null), [params.radius, params.lat, params.lon]);
  const query = useMemo(() => (zone ? params : { ...params, bbox }), [zone, params, bbox]);
  const key = `${statId}?${JSON.stringify(query)}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: '' });

  // A zone is shown whole once, then the user moves freely
  const zoneKey = zone ? `${zone.lat},${zone.lon},${zone.km}` : '';
  useEffect(() => {
    if (!zoneKey) return;
    const [lat, lon, km] = zoneKey.split(',').map(Number);
    map.fitBounds(L.latLng(lat, lon).toBounds(km * 2000), { padding: [8, 8] });
  }, [zoneKey, map]);

  useEffect(() => {
    let cancelled = false;
    fetchStat<MapStatResult>(statId, query)
      .then((result) => { if (!cancelled) setLoaded({ key, result }); })
      .catch((e: unknown) => {
        if (cancelled) return;
        const error = e instanceof StatsError ? e : new StatsError(String(e));
        setLoaded({ key, error: error.message, status: error.status });
      });
    return () => { cancelled = true; };
    // `query` is what `key` says
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = loaded.key !== key;
  const result = loaded.result;
  useEffect(() => {
    onState?.({
      loading, result, error: loaded.error, tooLarge: loaded.status === 422, bbox: zone ? null : bbox,
    });
    // Reported whenever what the map shows changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, result, loaded.error, loaded.status, bbox]);

  return (
    <>
      {zone && (
        <Circle
          center={[zone.lat, zone.lon]}
          radius={zone.km * 1000}
          pathOptions={{ color: '#343a40', weight: 1.5, dashArray: '5 4', fill: false }}
          interactive={false}
        />
      )}
      {result && !loaded.error && (
        <GeoJSON
          // A new result is a new layer: GeoJSON does not follow its data
          key={`${result.computed_at}-${selectedId ?? ''}`}
          data={result.cells as GeoJSON.FeatureCollection}
          style={(feature) => {
            const properties = feature?.properties as GridCellProperties;
            return cellStyle(layer, properties, properties.id === selectedId);
          }}
          // @ts-expect-error: `renderer` is a path option Leaflet passes on to each cell
          renderer={renderer}
          eventHandlers={{
            click: (event) => {
              L.DomEvent.stopPropagation(event);
              onSelect?.((event.propagatedFrom?.feature?.properties ?? null) as GridCellProperties | null);
            },
          }}
        />
      )}
      {showTraps && result?.traps.map(([lat, lon]) => (
        <CircleMarker
          key={`${lat},${lon}`}
          center={[lat, lon]}
          radius={4}
          renderer={renderer}
          interactive={false}
          pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: '#212529', fillOpacity: 1 }}
        />
      ))}
    </>
  );
}
