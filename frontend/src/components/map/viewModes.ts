/**
 * View modes of the interactive map.
 *
 * The map is the same everywhere; a view mode only tells it how to open for
 * the page or module that shows it: which layers are on, whether it centres
 * on an object, whether that object is being moved, and how to go back to the
 * caller. Module pages pass their mode as a prop; the map module reads it from
 * its URL (`/map?view_mode=...`), which lets another module open the map on an
 * object and come back (see `mapUrl`).
 */
export type MapViewMode = 'map' | 'nests' | 'apiary' | 'trap' | 'trap-move';

interface LayerSet {
  traps: boolean;
  nests: boolean;
  apiaries: boolean;
  hornets?: boolean;
}

export interface MapViewModeConfig {
  /** Layers switched on when the map opens (`roles` for role-dependent ones); unset keeps them as they are */
  layers?: (roles: string[]) => LayerSet;
  /** Centres on the trap given by `focusTrapId` and highlights it */
  focusTrap?: boolean;
  /** Puts that trap in move mode; validating or cancelling returns to the caller */
  moveTrap?: boolean;
  /** Centres on the apiary given by `focusApiaryId` and highlights it */
  focusApiary?: boolean;
  /** Label of the back button, shown when the caller gave a return path */
  backLabel?: string;
}

export const MAP_VIEW_MODES: Record<MapViewMode, MapViewModeConfig> = {
  // Overview: traps and nests, hornets hidden, apiaries for beekeepers
  map: {
    layers: (roles) => ({ traps: true, nests: true, apiaries: roles.includes('beekeeper'), hornets: false }),
  },
  // Nest finding: the layers as the user left them
  nests: {},
  // One apiary among the others, reached from the apiary manager; the other
  // layers one switch away
  apiary: {
    layers: () => ({ traps: false, nests: false, apiaries: true, hornets: false }),
    focusApiary: true,
    backLabel: 'Ruchers',
  },
  // One trap in its surroundings, reached from the trap manager
  trap: {
    layers: () => ({ traps: true, nests: false, apiaries: false }),
    focusTrap: true,
    backLabel: 'Pièges',
  },
  // Dragging one trap to its new position, from the trap manager
  'trap-move': {
    layers: () => ({ traps: true, nests: false, apiaries: false }),
    focusTrap: true,
    moveTrap: true,
    backLabel: 'Pièges',
  },
};

export function isMapViewMode(value: string | null | undefined): value is MapViewMode {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(MAP_VIEW_MODES, value as string);
}

/** A return path is only followed inside the application, never to another site. */
export function safeReturnPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return undefined;
  return value;
}

/** Link to the map module in a given view mode, e.g. from the trap manager. */
export function mapUrl({ mode, trap, apiary, from }: {
  mode: MapViewMode; trap?: number; apiary?: number; from?: string;
}): string {
  const params = new URLSearchParams({ view_mode: mode });
  if (trap !== undefined) params.set('trap', String(trap));
  if (apiary !== undefined) params.set('apiary', String(apiary));
  const back = safeReturnPath(from);
  if (back) params.set('from', back);
  return `/map?${params}`;
}
