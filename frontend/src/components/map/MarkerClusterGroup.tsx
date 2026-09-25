import type { ReactNode } from 'react';
import { createElementObject, createLayerComponent, extendContext, type LayerProps } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { OVERLAP_THRESHOLD_PIXELS } from '../../utils/constants';

interface MarkerClusterGroupProps extends LayerProps {
  children?: ReactNode;
  /** Tap on a cluster: the map decides between fanning out, zooming in and the list */
  onClusterClick: (cluster: L.MarkerCluster) => void;
  /** A cluster was fanned out (true) or folded back (false) */
  onSpiderfyChange?: (open: boolean) => void;
}

interface Callbacks {
  onClusterClick: (cluster: L.MarkerCluster) => void;
  onSpiderfyChange?: (open: boolean) => void;
}

/** Latest callbacks of each group: the Leaflet listeners are bound once */
const callbacks = new WeakMap<L.MarkerClusterGroup, Callbacks>();

/** Symbol of a marker, from the class of its icon (see the markers components) */
const MARKER_SYMBOLS: [string, string][] = [
  ['trap-icon', '🪤'],
  ['nest-icon', '🏴'],
  ['apiary-icon', '🍯'],
];

function markerSymbol(marker: L.Marker): string {
  const className = marker.options.icon?.options.className ?? '';
  return MARKER_SYMBOLS.find(([name]) => className.includes(name))?.[1] ?? '📍';
}

/** Cluster marker: the kinds of objects it holds (three at most) and their count */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const symbols = [...new Set(cluster.getAllChildMarkers().map(markerSymbol))].slice(0, 3);
  return L.divIcon({
    html: `<span class="map-cluster-symbol">${symbols.join('')}</span><span class="map-cluster-count">${cluster.getChildCount()}</span>`,
    className: 'map-cluster',
    iconSize: [48, 48],
  });
}

/**
 * Groups the markers of the map (nests, apiaries, traps) that would overlap
 * at the current zoom into one marker showing their kinds and count. Unlike
 * the default behaviour, a tap does not always zoom in: the map chooses (see
 * InteractiveMap), and a fanned-out cluster shows each object around its spot.
 */
const MarkerClusterGroup = createLayerComponent<L.MarkerClusterGroup, MarkerClusterGroupProps>(
  ({ onClusterClick, onSpiderfyChange }, context) => {
    const instance = L.markerClusterGroup({
      // Same distance as the overlap detection: markers closer than that always group
      maxClusterRadius: OVERLAP_THRESHOLD_PIXELS,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      spiderfyDistanceMultiplier: 1.8,
      // Legs from the objects' true spot to their marker, visible on the map
      spiderLegPolylineOptions: { weight: 2, color: '#0d6efd', opacity: 0.7 },
      iconCreateFunction: clusterIcon,
    });
    callbacks.set(instance, { onClusterClick, onSpiderfyChange });
    instance.on('clusterclick', (event) => {
      callbacks.get(instance)?.onClusterClick((event as L.LeafletEvent & { layer: L.MarkerCluster }).layer);
    });
    instance.on('spiderfied', () => callbacks.get(instance)?.onSpiderfyChange?.(true));
    instance.on('unspiderfied', () => callbacks.get(instance)?.onSpiderfyChange?.(false));
    return createElementObject(instance, extendContext(context, { layerContainer: instance }));
  },
  (instance, { onClusterClick, onSpiderfyChange }) => {
    callbacks.set(instance, { onClusterClick, onSpiderfyChange });
  },
);

export default MarkerClusterGroup;
