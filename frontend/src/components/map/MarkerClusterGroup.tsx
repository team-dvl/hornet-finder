import type { ReactNode } from 'react';
import { createElementObject, createLayerComponent, extendContext, type LayerProps } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';

interface MarkerClusterGroupProps extends LayerProps {
  children?: ReactNode;
  /** Emoji of the layer, shown on its clusters with the count */
  symbol: string;
}

/** Clusters of a layer stop at this zoom: closer, every marker shows on its own */
const CLUSTER_UNTIL_ZOOM = 17;

/**
 * Groups the markers of one layer that sit close together at the current
 * zoom into a single marker carrying their count; a tap on it zooms in. The
 * overlap sheet is then left for objects at the very same place.
 */
const MarkerClusterGroup = createLayerComponent<L.MarkerClusterGroup, MarkerClusterGroupProps>(
  ({ symbol }, context) => {
    const instance = L.markerClusterGroup({
      maxClusterRadius: 40,
      disableClusteringAtZoom: CLUSTER_UNTIL_ZOOM,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => L.divIcon({
        html: `<span class="map-cluster-symbol">${symbol}</span><span class="map-cluster-count">${cluster.getChildCount()}</span>`,
        className: 'map-cluster',
        iconSize: [44, 44],
      }),
    });
    return createElementObject(instance, extendContext(context, { layerContainer: instance }));
  },
);

export default MarkerClusterGroup;
