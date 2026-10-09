import { DEFAULT_GEOLOCATION, DEFAULT_ZOOMFACTOR, MAX_ZOOM } from './constants';

/** Where the user left the map, remembered per device. */
export interface MapView {
  latitude: number;
  longitude: number;
  zoom: number;
}

const KEY = 'map-last-view';

/** A remembered view older than this is dropped, so a wrong one cannot stay for ever */
export const MAP_VIEW_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_MAP_VIEW: MapView = { ...DEFAULT_GEOLOCATION, zoom: DEFAULT_ZOOMFACTOR };

/** The remembered view, or null when unset, expired, malformed or storage is unavailable */
export function loadMapView(now = Date.now()): MapView | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { latitude, longitude, zoom, savedAt } = JSON.parse(raw);
    const valid =
      Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      Number.isFinite(longitude) && Math.abs(longitude) <= 180 &&
      Number.isFinite(zoom) && zoom >= 1 && zoom <= MAX_ZOOM &&
      Number.isFinite(savedAt) && now - savedAt >= 0 && now - savedAt <= MAP_VIEW_TTL_MS;
    return valid ? { latitude, longitude, zoom } : null;
  } catch {
    return null;
  }
}

/** Remember the view the user chose by moving the map; each save restarts the expiry */
export function saveMapView(view: MapView, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...view, savedAt: now }));
  } catch {
    // Storage unavailable: the view only lasts for this visit
  }
}

export function clearMapView(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear
  }
}
