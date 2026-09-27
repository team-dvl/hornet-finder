/**
 * Colours of the 250 m grid: one hue, light to dark, for a magnitude (the
 * share of a cell covered, the pressure). Cells without a value are not
 * drawn at all, so the map shows through.
 */
import type { PathOptions } from 'leaflet';
import type { GridCellProperties } from '../../utils/statsApi';

export type GridLayer = 'coverage' | 'pressure';

/** Covered share: up to a third, up to two thirds, more */
const COVERAGE_COLORS = ['#cfe0f6', '#8db6ea', '#2a78d6'];
/** Pressure classes, split by the server's `bins` */
const PRESSURE_COLORS = ['#fde6d8', '#f9c29f', '#f39a68', '#e8703d', '#c4501f', '#8a3212'];

export function coverageClass(share: number): number {
  return share <= 1 / 3 ? 0 : share <= 2 / 3 ? 1 : 2;
}

export function cellColor(layer: GridLayer, properties: GridCellProperties): string {
  if (layer === 'coverage') return COVERAGE_COLORS[coverageClass(properties.covered ?? 0)];
  return PRESSURE_COLORS[Math.min(properties.level ?? 0, PRESSURE_COLORS.length - 1)];
}

export function cellStyle(layer: GridLayer, properties: GridCellProperties, selected: boolean): PathOptions {
  return {
    fillColor: cellColor(layer, properties),
    fillOpacity: 0.6,
    // A 1 px white edge keeps neighbouring cells apart; the selected one is outlined
    color: selected ? '#212529' : '#ffffff',
    weight: selected ? 2 : 0.5,
    opacity: selected ? 1 : 0.8,
  };
}

const LOCALE = 'fr-BE';
const number = (value: number) => value.toLocaleString(LOCALE, { maximumFractionDigits: 2 });

/** Legend entries: a colour and what it stands for. */
export function legend(layer: GridLayer, bins: number[] = []): { color: string; label: string }[] {
  if (layer === 'coverage') {
    return [
      { color: COVERAGE_COLORS[0], label: '≤ 33 %' },
      { color: COVERAGE_COLORS[1], label: '≤ 66 %' },
      { color: COVERAGE_COLORS[2], label: '> 66 %' },
    ];
  }
  return [0, ...bins].map((low, index) => ({
    color: PRESSURE_COLORS[Math.min(index, PRESSURE_COLORS.length - 1)],
    label: index === 0 ? `< ${number(bins[0] ?? 0)}` : `≥ ${number(low)}`,
  }));
}
